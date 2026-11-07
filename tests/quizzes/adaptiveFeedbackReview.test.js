import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReviewTopics,
  getReviewMetadata,
  getReviewTopic,
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
