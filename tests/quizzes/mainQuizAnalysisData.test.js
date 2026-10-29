import assert from "node:assert/strict";
import {
  mainQuizKey,
  mainQuizQuestions,
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
console.log(
  "Main quiz analysis uses recorded totals and question positions, not unique text counts.",
);
