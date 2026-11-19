import assert from "node:assert/strict";
import test from "node:test";
import { LEARNING_FEEDBACK_VERSION, buildNextGoal, buildConceptReview } from "../../src/utils/learningFeedback.js";
import {
  buildReviewTopics,
  buildMistakeReviewTopics,
  buildCurrentPracticeFeedback,
  getReviewMetadata,
  getReviewTopic,
  upgradePracticeFeedback,
} from "../../src/pages/course/feedbackReview.js";

const title = "The Self from Various Perspectives";
const answers = [
  {
    question:
      "According to George Herbert Mead, which aspect of the self is spontaneous?",
    correctAnswer: "I",
    userAnswer: "Me",
    explanation: "The I is the spontaneous response of the self.",
  },
  {
    question:
      "In Sigmund Freud’s psychoanalytic theory, which component follows the pleasure principle?",
    correctAnswer: "Id",
    userAnswer: "Ego",
    explanation: "The id follows the pleasure principle.",
  },
  {
    question: "Which philosopher distinguished the mind and body?",
    correctAnswer: "René Descartes",
    userAnswer: "Plato",
    explanation: "Descartes distinguished the mind and body.",
  },
];

test("legacy Q&A results become specific topics with their saved explanations", () => {
  const reviews = buildReviewTopics(answers, title);
  assert.deepEqual(
    reviews.map((review) => review.topic),
    ["George Herbert Mead: I", "Sigmund Freud: Id", "René Descartes"],
  );
  assert.deepEqual(
    reviews.map((review) => review.explanation),
    answers.map((answer) => answer.explanation),
  );
  assert.ok(
    reviews.every(
      (review) => !answers.some((answer) => review.topic === answer.question),
    ),
  );
});

test("specific metadata takes priority over answers and the overall lesson title", () => {
  assert.equal(
    getReviewTopic(
      { ...answers[0], concept: " Mead’s I and me ", topic: title },
      title,
    ).topic,
    "Mead’s I and me",
  );
  assert.equal(
    getReviewTopic({ ...answers[0], topic: title }, title).topic,
    "George Herbert Mead: I",
  );
  assert.equal(
    getReviewTopic(
      { correctAnswer: "", correct_answer: "Photosynthesis" },
      "Plants",
    ).topic,
    "Photosynthesis",
  );
});

test("repeated concepts merge before the review limit and keep available explanations", () => {
  const reviews = buildReviewTopics(
    [
      { concept: "Photosynthesis" },
      {
        concept: " photosynthesis ",
        explanation: "Plants convert light energy.",
      },
      { concept: "Chlorophyll" },
      { concept: "Roots" },
      { concept: "Leaves" },
    ],
    "Plants",
  );
  assert.equal(reviews.length, 3);
  assert.equal(reviews[0].explanation, "Plants convert light energy.");
  assert.deepEqual(
    reviews.map((review) => review.topic),
    ["Photosynthesis", "Chlorophyll", "Roots"],
  );
});

test("questions and bare True/False answers are not presented as review topics", () => {
  for (const correctAnswer of ["True", "False.", "yes", "No", "42"])
    assert.equal(
      getReviewTopic({ question: "Question?", correctAnswer }, "Plants").topic,
      "Plants",
    );
  assert.equal(
    getReviewTopic(
      {
        question: "Which term stores a value?",
        concept: "Which term stores a value?",
        correctAnswer: "Variable",
      },
      "Programming",
    ).topic,
    "Variable",
  );
});

test("missing explanations use review guidance without inventing subject facts", () => {
  assert.equal(
    getReviewTopic(
      { correctAnswer: "Variable", explanation: "Variable" },
      "Programming",
    ).explanation,
    "",
  );
  const reviews = buildReviewTopics([{ concept: "Variables" }], "Programming");
  assert.equal(reviews[0].topic, "Variables");
  assert.match(
    reviews[0].explanation,
    /Revisit the lesson explanation of Variables/,
  );
  assert.deepEqual(buildReviewTopics([], title), []);
});

test("Q&A metadata keeps concept and cognitive classifications without copying answers", () => {
  assert.deepEqual(
    getReviewMetadata({
      concept: " Definition ",
      topic: "Programming",
      cognitive_level: "Understand",
      thinking_skill: "LOTS",
      question: "Question?",
      userAnswer: "wrong",
    }),
    {
      concept: "Definition",
      topic: "Programming",
      cognitive_level: "Understand",
      thinking_skill: "LOTS",
    },
  );
});

test("review guidance explains likely confusion and gives a study strategy instead of an answer-key recap", () => {
  const reviews = buildMistakeReviewTopics(answers, title);
  assert.doesNotMatch(reviews[0].explanation, /confusion between/);
  assert.match(reviews[0].explanation, /spontaneous response/);
  assert.match(reviews[0].studyTip, /own words/);
  assert.doesNotMatch(
    reviews[0].explanation,
    /You answered|saved correct answer/,
  );
});

test("older saved results show latest accuracy and deduplicated evidence without inventing history", () => {
  const feedback = buildCurrentPracticeFeedback(
    [
      { concept: "Atomicity", topic: "Transactions", isCorrect: true },
      { concept: " atomicity ", topic: "Transactions", isCorrect: true },
      {
        concept: "Isolation",
        topic: "Transactions",
        isCorrect: false,
        userAnswer: "Durability",
        correctAnswer: "Isolation",
      },
      { concept: "Isolation", topic: "Transactions", isCorrect: true },
    ],
    "Databases",
    "multiple",
  )[0];
  assert.equal(feedback.latestAccuracy, 75);
  assert.equal(feedback.metricLabel, "Latest topic accuracy");
  assert.equal(feedback.strengths.length, 1);
  assert.equal(feedback.historicalAccuracy, undefined);
  assert.match(feedback.nextGoal, /new question about Isolation/);
  assert.doesNotMatch(feedback.adaptiveRecommendation, /advanced/);
  assert.deepEqual(feedback.areasForImprovement, ["Isolation"]);
});

test("unanswered legacy questions and flashcard ratings cannot establish mastery", () => {
  assert.equal(
    buildCurrentPracticeFeedback([{}], "Variables", "qna")[0].latestAccuracy,
    0,
  );
  const feedback = buildCurrentPracticeFeedback(
    [{ isCorrect: true }],
    "Variables",
    "flashcard",
  )[0];
  assert.equal(feedback.latestAccuracy, null);
  assert.deepEqual(feedback.strengths, []);
  assert.match(feedback.nextGoal, /graded practice quiz/);
});

test("legacy feedback upgrades to educational review while preserving its measured history", () => {
  const current = [
    {
      ...answers[0],
      concept: "Mead's I and me",
      topic: "The Self",
      isCorrect: false,
    },
    {
      ...answers[1],
      concept: "Freud's id",
      topic: "The Self",
      isCorrect: true,
    },
  ];
  const feedback = upgradePracticeFeedback(
    {
      topic: "The Self",
      questionIndexes: [0, 1],
      latestAccuracy: 50,
      historicalAccuracy: 40,
      gradedAttempts: 3,
      recurring: true,
      recommendation: 'You answered "Me"; the saved correct answer is "I".',
      adaptiveRecommendation: "Try advanced questions.",
      misconceptions: [{ ...current[0] }],
    },
    current,
    title,
    "qna",
  );
  assert.equal(feedback.feedbackVersion, LEARNING_FEEDBACK_VERSION);
  assert.equal(feedback.latestAccuracy, 50);
  assert.equal(feedback.historicalAccuracy, 40);
  assert.equal(feedback.gradedAttempts, 3);
  assert.match(feedback.recommendation, /missed 1 of the 2/);
  assert.match(
    feedback.suggestedReviewTopics[0].explanation,
    /spontaneous response/,
  );
  assert.match(
    feedback.suggestedReviewTopics[0].studyTip,
    /own words/,
  );
  assert.doesNotMatch(feedback.adaptiveRecommendation, /advanced/);
  assert.doesNotMatch(
    feedback.recommendation,
    /You answered|saved correct answer/,
  );
  assert.match(feedback.nextGoal, /new question/);
});

test("historical-only feedback does not claim the topic was tested in the latest attempt", () => {
  const feedback = upgradePracticeFeedback(
    {
      topic: "The Self",
      questionIndexes: [],
      latestTotal: 0,
      latestAccuracy: null,
      historicalAccuracy: 20,
      misconceptions: [{ ...answers[0], concept: "Mead's I and me" }],
    },
    [{ topic: "Other topic", isCorrect: true }],
    title,
    "qna",
  );
  assert.deepEqual(feedback.strengths, []);
  assert.equal(feedback.latestAccuracy, null);
  assert.match(feedback.recommendation, /did not cover/);
  assert.doesNotMatch(
    feedback.recommendation,
    /latest responses show progress/,
  );
  assert.match(feedback.suggestedReviewTopics[0].studyTip, /own words/);
});

test("already updated feedback keeps its source-based explanation and study tip", () => {
  const feedback = {
    feedbackVersion: LEARNING_FEEDBACK_VERSION,
    suggestedReviewTopics: [
      {
        topic: "Variables",
        explanation: "Saved explanation.",
        studyTip: "Trace a variable in the lesson's code example.",
      },
    ],
  };
  assert.equal(upgradePracticeFeedback(feedback, [], title, "qna"), feedback);
});

 test("numeric goals use actual quiz size and configured criteria", () => {
  assert.match(buildNextGoal({score:2,total:7,masteryTarget:80}, "Concept"), /3\/7.*80%.*6\/7/);
  assert.match(buildNextGoal({score:6,total:7,masteryTarget:80}, "Concept"), /Maintain at least 6\/7/);
  assert.doesNotMatch(buildNextGoal({score:2,total:7}, "Concept"), /\d+\//);
 });
 test("study strategies follow question evidence", () => {
  const base = {concept:"Concept", userAnswer:"Other", correctAnswer:"Concept", explanation:"A lesson definition."};
  assert.match(buildConceptReview({...base, question:"What is the first step?"}).studyTip, /steps.*in order/);
  assert.match(buildConceptReview({...base, cognitive_level:"Apply"}).studyTip, /practical example/);
  assert.match(buildConceptReview({...base, cognitive_level:"Analyze"}).studyTip, /support the answer/);
  assert.match(buildConceptReview(base, undefined, true).studyTip, /different example/);
  assert.match(buildConceptReview({...base, explanation:"Other differs from Concept in the lesson."}).studyTip, /Compare Other with Concept/);
 });
 test("a correct latest response keeps earlier weakness while acknowledging improvement", () => {
  const feedback = upgradePracticeFeedback({topic:"Lesson", misconceptions:[{concept:"Concept", question:"Earlier?", userAnswer:"Other", correctAnswer:"Concept", isCorrect:false}]}, [{topic:"Lesson",concept:"Concept",question:"Latest?",isCorrect:true}], "Lesson", "multiple");
  assert.equal(feedback.understanding,"Improving");
  assert.equal(feedback.suggestedReviewTopics[0].historicalOnly,true);
  assert.equal(feedback.suggestedReviewTopics[0].improved,true);
 });
