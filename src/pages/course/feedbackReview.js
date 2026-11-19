import {
  buildConceptReview,
  buildReviewCards,
  buildNextGoal,
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

function withReviewConcept(answer, fallbackTopic) {
  const review = getReviewTopic(answer, fallbackTopic);
  return { ...answer, concept: review.topic, explanation: review.explanation };
}

export function buildMistakeReviewTopics(answers, fallbackTopic, limit = Infinity) {
  return buildReviewCards(answers.map(answer => withReviewConcept(answer, fallbackTopic))).slice(0, limit);
}

function goalInputs(result, answers) {
  const total = result.total ?? answers.length;
  const complete = answers.length === total && answers.every(answer => answer.answerKeyValid !== false && !answer.isSelfAssessed);
  return {
    total,
    score: complete ? answers.filter(isCorrect).length : undefined,
    masteryTarget: result.masteryTarget ?? result.passingPercentage ?? result.passing_percentage,
  };
}

// Upgrade saved feedback without creating historical observations from a lifetime attempt count.
function describeTopic(feedback, current, topic, quizMode, goal) {
  const selfAssessed = Boolean(feedback.selfAssessed || quizMode === "flashcard");
  current = current.filter(answer => answer.answerKeyValid !== false).map(answer => ({
    ...withReviewConcept(answer, topic), isSelfAssessed: selfAssessed || answer.isSelfAssessed,
  }));
  const graded = current.filter(answer => !answer.isSelfAssessed);
  const latestTotal = feedback.latestTotal ?? graded.length;
  const latestCorrect = feedback.latestCorrect ?? graded.filter(isCorrect).length;
  const latestAccuracy = selfAssessed || !latestTotal ? null : Math.round(100 * latestCorrect / latestTotal);
  const recallPercentage = selfAssessed && current.length ? Math.round(100 * current.filter(isCorrect).length / current.length) : null;
  const misses = current.filter(answer => !isCorrect(answer));
  const identity = answer => normalize(answer.question) + "|" + normalize(answer.userAnswer || answer.selectedAnswer);
  const currentKeys = new Set(misses.map(identity));
  const previous = (feedback.misconceptions || []).filter(miss => miss && miss.answerKeyValid !== false && !currentKeys.has(identity(miss)))
    .map(miss => withReviewConcept(miss, topic));
  const reviews = buildReviewCards(misses, previous);
  // Some older records contain only the saved review cards. Keep their lesson text
  // and replace old template activities when there is no underlying response.
  const seen = new Set(reviews.map(review => normalize(review.topic)));
  for (const card of feedback.suggestedReviewTopics || []) {
    const name = cleanText(typeof card === "string" ? card : card?.topic);
    if (!name || seen.has(normalize(name))) continue;
    const explanation = cleanText(card.explanation).replace(/^Your answer suggests possible confusion between .+?\.\s*/i, "");
    const review = buildConceptReview({concept:name, explanation, question:card.question, isSelfAssessed:selfAssessed}, topic);
    review.explanation = explanation || "Find the definition or example of " + name + " in your lesson.";
    if (card.studyTip && !/two-column comparison/i.test(card.studyTip)) review.studyTip = card.studyTip;
    review.historicalOnly = !current.length || latestTotal > 0 && latestCorrect === latestTotal;
    reviews.push(review);
    seen.add(normalize(name));
  }
  const failedConcepts = new Set(misses.map(answer => normalize(answer.concept)));
  const improvedConcepts = new Set(graded.filter(isCorrect).map(answer => normalize(answer.concept)));
  reviews.forEach(review => { review.improved = review.historicalOnly && improvedConcepts.has(normalize(review.topic)); });
  const strengths = unique(graded.filter(isCorrect).map(answer => answer.concept).filter(name => !failedConcepts.has(normalize(name))))
    .map(name => "Correctly answered on this attempt: " + name + ".");
  const earlierMistakes = previous.length > 0 || feedback.missedAttempts > (misses.length ? 1 : 0) ||
    feedback.historicalTotal - feedback.historicalCorrect > latestTotal - latestCorrect ||
    (latestTotal > 0 && latestTotal === latestCorrect && feedback.historicalAccuracy != null && feedback.historicalAccuracy < 100);
  const plan = buildLearningPlan({topic, reviews, latestCorrect, latestTotal, selfAssessed, recallPercentage,
    earlierMistakes, foundation: goal.total > 0 && goal.score / goal.total < 0.6});
  return {
    ...feedback, ...plan, feedbackVersion: LEARNING_FEEDBACK_VERSION, topic, strengths, selfAssessed,
    latestCorrect, latestTotal, latestAccuracy, recallPercentage, confidence: latestAccuracy,
    metricLabel: selfAssessed ? "Self-assessed recall" : "Latest topic accuracy",
    areasForImprovement: reviews.map(review => review.topic), suggestedReviewTopics: reviews,
    nextGoal: buildNextGoal(goal, reviews[0]?.topic || topic, {selfAssessed, assessed: selfAssessed ? recallPercentage != null : latestTotal > 0}),
  };
}

export function buildCurrentPracticeFeedback(answers, contentTitle, quizMode, result = {}) {
  const groups = new Map();
  answers.forEach((answer, index) => {
    if (answer.answerKeyValid === false) return;
    const topic = cleanText(answer.topic) || contentTitle || "Module concepts";
    const id = normalize(topic);
    if (!groups.has(id)) groups.set(id, {topic, current:[], questionIndexes:[]});
    groups.get(id).current.push(answer);
    groups.get(id).questionIndexes.push(index);
  });
  const goal = goalInputs(result, answers);
  return [...groups.values()].map(({topic, current, questionIndexes}) =>
    describeTopic({questionIndexes}, current, topic, quizMode, goal));
}

export function upgradePracticeFeedback(feedback, answers, contentTitle, quizMode, result = {}) {
  if (feedback.feedbackVersion === LEARNING_FEEDBACK_VERSION) return feedback;
  const topic = cleanText(feedback.topic) || contentTitle || "Module concepts";
  const indexes = feedback.questionIndexes ?? feedback.question_indexes;
  const current = Array.isArray(indexes)
    ? indexes.map(index => answers[index]).filter(Boolean)
    : answers.filter(answer => normalize(answer.topic || contentTitle) === normalize(topic));
  return describeTopic(feedback, current, topic, quizMode, goalInputs(result, answers));
}
