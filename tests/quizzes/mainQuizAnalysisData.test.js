import assert from "node:assert/strict";
import {
  mainQuizKey,
  mainQuizQuestions,
  mainQuizAnswerAt,
} from "../../src/services/mainQuizAnalysisData.js";

const attempts = [0, 1].map((student) => ({
  total: 10,
  module_index: 0,
  answers: Array.from({ length: 10 }, (_, index) => ({
    question: `Student ${student} version, question ${index + 1}`,
  })),
}));
const questions = mainQuizQuestions(attempts);
assert.equal(questions.length, 10);
assert.equal(questions[9].attemptIndex, 9);
assert.equal(mainQuizKey({ module_index: 1 }), "1");
assert.equal(mainQuizQuestions([{ total: 5, answers: [] }]).length, 5);
assert.equal(mainQuizQuestions([]).length, 0);
const shuffledAttempts = [
  {
    total: 3,
    answers: [
      { question: "Third", source_question_index: 2, isCorrect: false },
      { question: "First", source_question_index: 0, isCorrect: true },
      { question: "Second", source_question_index: 1, isCorrect: false },
    ],
  },
  {
    total: 3,
    answers: [
      { question: "Second", source_question_index: 1, isCorrect: true },
      { question: "Third", source_question_index: 2, isCorrect: true },
      { question: "First", source_question_index: 0, isCorrect: false },
    ],
  },
];
assert.deepEqual(
  mainQuizQuestions(shuffledAttempts).map((question) => question.question),
  ["First", "Second", "Third"],
);
assert.equal(mainQuizAnswerAt(shuffledAttempts[0], 0).isCorrect, true);
assert.equal(mainQuizAnswerAt(shuffledAttempts[1], 0).isCorrect, false);
assert.equal(mainQuizAnswerAt(shuffledAttempts[1], 1).isCorrect, true);
assert.equal(mainQuizAnswerAt(attempts[0], 9), attempts[0].answers[9]);
const partial = {
  total: 3,
  answers: [{ question: "Third", source_question_index: 2 }],
};
assert.equal(mainQuizAnswerAt(partial, 0), undefined);
assert.equal(mainQuizQuestions([partial])[2].question, "Third");
console.log(
  "Main quiz analysis preserves question identities across shuffled orders and legacy results.",
);
