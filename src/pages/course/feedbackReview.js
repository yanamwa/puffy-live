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
