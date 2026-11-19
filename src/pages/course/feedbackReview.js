import {
  buildConceptReview,
  buildLearningPlan,
  LEARNING_FEEDBACK_VERSION,
} from "../../utils/learningFeedback.js";

const cleanText = (value) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const normalize = (value) => cleanText(value).normalize("NFC").toLowerCase();
const unique = (values) => [
  ...new Map(values.map((value) => [normalize(value), value])).values(),
];
const isCorrect = (answer) =>
  typeof answer.isCorrect === "boolean"
    ? answer.isCorrect
    : Boolean(cleanText(answer.userAnswer || answer.selectedAnswer)) &&
      normalize(answer.userAnswer || answer.selectedAnswer) ===
        normalize(
          answer.correctAnswer || answer.correct_answer || answer.answer,
        );

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
    const existing = topics.get(key);
    if (!existing || (!existing.hasExplanation && review.explanation))
      topics.set(key, {
        review: buildConceptReview(
          { ...answer, concept: review.topic, explanation: review.explanation },
          fallbackTopic,
        ),
        hasExplanation: Boolean(review.explanation),
      });
  }
  return [...topics.values()].slice(0, limit).map(({ review }) => review);
}

// Used for older saved results that have no server feedback. No history is
// inferred from the attempt counter or from browser storage.
export function buildCurrentPracticeFeedback(answers, contentTitle, quizMode) {
  const correct = isCorrect;
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
    const reviews = buildMistakeReviewTopics(
      missed.map((answer) => ({
        ...answer,
        isSelfAssessed: selfAssessed || answer.isSelfAssessed,
      })),
      topic,
    );
    const failedConcepts = new Set(
      missed.map((answer) => normalize(getReviewTopic(answer, topic).topic)),
    );
    const strengthConcepts = selfAssessed
      ? []
      : [
          ...new Map(
            items
              .filter(correct)
              .map((answer) => getReviewTopic(answer, topic).topic)
              .filter((concept) => !failedConcepts.has(normalize(concept)))
              .map((concept) => [normalize(concept), concept]),
          ).values(),
        ].slice(0, 2);
    const strengths = strengthConcepts.map(
      (concept) => `Demonstrated understanding of ${concept} in this attempt.`,
    );
    const weakConcepts = unique(
      missed.map((answer) => getReviewTopic(answer, topic).topic),
    );
    const plan = buildLearningPlan({
      topic,
      strongConcepts: strengthConcepts,
      weakConcepts,
      currentWeakConcepts: weakConcepts,
      selfAssessed,
      foundation: score / total < 0.6,
    });
    return {
      feedbackVersion: LEARNING_FEEDBACK_VERSION,
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
      strengthConcepts,
      suggestedReviewTopics: reviews,
      areasForImprovement: weakConcepts,
      ...plan,
      nextGoal: selfAssessed
        ? `Complete a graded quiz and aim for ${target}/${nextTotal} (90%). Flashcard ratings do not establish mastery.`
        : `${achievedTarget ? "Maintain" : "Aim for"} at least ${achievedTarget ? target : nextScore}/${nextTotal} correct next time. The mastery target is 90% (${target}/${nextTotal}).`,
    };
  });
}
// Refresh the wording of saved feedback while retaining its recorded history metrics.
export function upgradePracticeFeedback(
  feedback,
  answers,
  contentTitle,
  quizMode,
) {
  if (feedback.feedbackVersion === LEARNING_FEEDBACK_VERSION) return feedback;
  const topic = cleanText(feedback.topic) || contentTitle || "Module concepts";
  const indexes = feedback.questionIndexes || feedback.question_indexes;
  const current = (
    Array.isArray(indexes)
      ? indexes.map((index) => answers[Number(index)]).filter(Boolean)
      : answers.filter(
          (answer) =>
            normalize(answer.topic || contentTitle) === normalize(topic),
        )
  )
    .filter((answer) => answer.answerKeyValid !== false)
    .map((answer) => ({ ...answer, topic }));
  const baseline = buildCurrentPracticeFeedback(current, topic, quizMode)[0];
  const overallGoal = buildCurrentPracticeFeedback(
    answers,
    contentTitle,
    quizMode,
  )[0]?.nextGoal;
  const selfAssessed = Boolean(
    feedback.selfAssessed || quizMode === "flashcard",
  );
  const currentMisses = current.filter((answer) => !isCorrect(answer));
  const recordedMisses = Array.isArray(feedback.misconceptions)
    ? feedback.misconceptions.filter(
        (miss) =>
          miss && typeof miss === "object" && miss.answerKeyValid !== false,
      )
    : [];
  const misses = [...currentMisses, ...recordedMisses].map((miss) => ({
    ...miss,
    isSelfAssessed: selfAssessed || miss.isSelfAssessed,
  }));
  const weakConcepts = unique(
    misses.map((miss) => getReviewTopic(miss, topic).topic),
  );
  const plan = buildLearningPlan({
    topic,
    strongConcepts: baseline?.strengthConcepts || [],
    currentWeakConcepts: unique(
      currentMisses.map((miss) => getReviewTopic(miss, topic).topic),
    ),
    weakConcepts,
    selfAssessed,
    hasCurrentAnswers: current.length > 0,
    recurring: Boolean(feedback.recurring),
    foundation: /^foundation/i.test(
      feedback.difficulty || baseline?.difficulty || "",
    ),
  });
  return {
    ...feedback,
    ...plan,
    feedbackVersion: LEARNING_FEEDBACK_VERSION,
    strengths: selfAssessed ? [] : baseline?.strengths || [],
    areasForImprovement: weakConcepts,
    suggestedReviewTopics: buildMistakeReviewTopics(misses, topic),
    nextGoal:
      overallGoal ||
      `Aim for at least 9/10 (90%) on a graded practice quiz and explain a fresh example of ${topic}.`,
  };
}
