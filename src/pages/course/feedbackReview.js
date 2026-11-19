const cleanText = (value) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const normalize = (value) => cleanText(value).normalize("NFC").toLowerCase();

export function getReviewMetadata(item) {
  return Object.fromEntries(
    [
      "concept",
      "subtopic",
      "topic",
      "category",
      "subject",
      "cognitive_level",
      "thinking_skill",
    ]
      .map((field) => [field, cleanText(item?.[field])])
      .filter(([, value]) => value),
  );
}

export function getReviewTopic(answer, fallbackTopic = "") {
  const question = cleanText(answer.question);
  const fallback =
    cleanText(fallbackTopic || answer.lessonTitle || answer.deckTitle) ||
    "Key lesson concepts";
  const isTopic = (value) => {
    const text = cleanText(value);
    return (
      text &&
      text.length <= 90 &&
      /\p{L}/u.test(text) &&
      !text.includes("?") &&
      !/^(?:true|false|yes|no)[.!]?$/i.test(text) &&
      !/^(?:what|which|who|when|where|why|how)\b/i.test(text) &&
      ![normalize(question), normalize(fallback), "general", "quiz"].includes(
        normalize(text),
      )
    );
  };
  const explicit = [
    answer.concept,
    answer.subtopic,
    answer.topic,
    answer.category,
    answer.subject,
  ]
    .map(cleanText)
    .find(isTopic);
  const correctAnswer =
    [answer.correctAnswer, answer.correct_answer, answer.answer]
      .map(cleanText)
      .find(Boolean) || "";
  const shortAnswer =
    isTopic(correctAnswer) && correctAnswer.split(" ").length <= 8
      ? correctAnswer
      : "";
  const attribution = question.match(
    /^(?:according to|in)\s+([^,]+?)(?:['’]s(?:\s+[^,]+)?|,)/i,
  )?.[1];
  const author =
    attribution && /^(?:\p{Lu}[\p{L}.'’-]*\s*){2,6}$/u.test(attribution)
      ? attribution
      : "";
  const topic =
    explicit ||
    (shortAnswer && author ? `${author}: ${shortAnswer}` : shortAnswer) ||
    fallback;
  const explanation = cleanText(answer.explanation);
  return {
    topic,
    explanation:
      explanation &&
      ![normalize(question), normalize(correctAnswer)].includes(
        normalize(explanation),
      )
        ? explanation
        : "",
  };
}

export function buildReviewTopics(answers, fallbackTopic, limit = 3) {
  const topics = new Map();
  for (const answer of answers) {
    const review = getReviewTopic(answer, fallbackTopic);
    const key = normalize(review.topic);
    const existing = topics.get(key);
    if (!existing) topics.set(key, review);
    else if (!existing.explanation && review.explanation)
      existing.explanation = review.explanation;
  }
  return [...topics.values()].slice(0, limit).map((review) => ({
    ...review,
    explanation:
      review.explanation ||
      `Revisit the lesson explanation of ${review.topic} and practise applying it to a new example.`,
  }));
}

export function buildMistakeReviewTopics(answers, fallbackTopic, limit = 3) {
  const topics = new Map();
  for (const answer of answers) {
    const review = getReviewTopic(answer, fallbackTopic);
    const key = normalize(review.topic);
    if (topics.has(key)) continue;
    const selected =
      cleanText(answer.userAnswer || answer.selectedAnswer) || "No answer";
    const correct = cleanText(
      answer.correctAnswer || answer.correct_answer || answer.answer,
    );
    topics.set(key, {
      topic: review.topic,
      question: cleanText(answer.question),
      explanation: answer.isSelfAssessed
        ? `Review this difficult card, then check your understanding with a graded question.`
        : `${correct ? `You answered "${selected}"; the saved correct answer is "${correct}". ` : ""}${review.explanation || `Revisit the lesson explanation of ${review.topic} before trying a new example.`}`,
    });
  }
  return [...topics.values()].slice(0, limit);
}

// Used for older saved results that have no server feedback. No history is
// inferred from the attempt counter or from browser storage.
export function buildCurrentPracticeFeedback(answers, contentTitle, quizMode) {
  const correct = (answer) =>
    typeof answer.isCorrect === "boolean"
      ? answer.isCorrect
      : Boolean(cleanText(answer.userAnswer || answer.selectedAnswer)) &&
        normalize(answer.userAnswer || answer.selectedAnswer) ===
          normalize(
            answer.correctAnswer || answer.correct_answer || answer.answer,
          );
  const groups = new Map();
  answers.forEach((answer, index) => {
    const topic = cleanText(answer.topic) || contentTitle || "Module concepts";
    const key = normalize(topic);
    if (!groups.has(key))
      groups.set(key, { topic, items: [], questionIndexes: [] });
    groups.get(key).items.push(answer);
    groups.get(key).questionIndexes.push(index);
  });
  const score = answers.filter(correct).length;
  const total = answers.length || 10;
  const nextTotal = 10;
  const target = 9;
  const achievedTarget = score / total >= 0.9;
  const nextScore = Math.min(
    target,
    Math.ceil(nextTotal * Math.max(0.6, score / total + 0.1)),
  );
  return [...groups.values()].map(({ topic, items, questionIndexes }) => {
    const hits = items.filter(correct).length;
    const confidence = Math.round((100 * hits) / items.length);
    const selfAssessed = quizMode === "flashcard";
    const missed = items.filter((answer) => !correct(answer));
    const reviews = buildMistakeReviewTopics(missed, topic);
    const failedConcepts = new Set(
      missed.map((answer) => normalize(getReviewTopic(answer, topic).topic)),
    );
    const strengths = selfAssessed
      ? []
      : [
          ...new Map(
            items
              .filter(correct)
              .map((answer) => getReviewTopic(answer, topic).topic)
              .filter((concept) => !failedConcepts.has(normalize(concept)))
              .map((concept) => [normalize(concept), concept]),
          ).values(),
        ]
          .slice(0, 2)
          .map(
            (concept) => `Answered correctly about ${concept} in this attempt.`,
          );
    return {
      topic,
      questionIndexes,
      confidence,
      selfAssessed,
      latestAccuracy: selfAssessed ? null : confidence,
      metricLabel: selfAssessed
        ? "Self-assessed recall"
        : "Latest topic accuracy",
      recallPercentage: selfAssessed ? confidence : null,
      latestCorrect: hits,
      latestTotal: items.length,
      understanding: selfAssessed
        ? "Check With Graded Practice"
        : confidence >= 80
          ? "Good Understanding"
          : confidence >= 60
            ? "Developing Understanding"
            : "Needs More Practice",
      strengths,
      suggestedReviewTopics: reviews,
      areasForImprovement: reviews.map((review) => review.topic),
      recommendation:
        reviews[0]?.explanation || `Check ${topic} again using new examples.`,
      adaptiveRecommendation: missed.length
        ? `Review ${reviews.map((review) => review.topic).join(", ")}. Practice these missed concepts with clearer questions and different scenarios.`
        : "Review other weak topics, if present, and use fresh examples at the same baseline difficulty.",
      difficulty: score / total < 0.6 ? "Foundation" : "Steady practice",
      nextGoal: selfAssessed
        ? `Complete a graded quiz and aim for ${target}/${nextTotal} (90%). Flashcard ratings do not establish mastery.`
        : `${achievedTarget ? "Maintain" : "Aim for"} at least ${achievedTarget ? target : nextScore}/${nextTotal} correct next time. The mastery target is 90% (${target}/${nextTotal}).`,
    };
  });
}
