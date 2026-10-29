import assert from "node:assert/strict";
import { readMainQuizResponseAnswer } from "../../src/services/mainQuizResponse.js";
assert.equal(readMainQuizResponseAnswer(null, 2).question, "Question 3");
assert.equal(readMainQuizResponseAnswer(null, 0).isCorrect, null);
assert.equal(
  readMainQuizResponseAnswer(
    { selected_answer: false, correct_answer: false },
    0,
  ).selected,
  "false",
);
assert.equal(
  readMainQuizResponseAnswer(
    { selected_answer: "wrong", correct_answer: "right", is_correct: false },
    0,
  ).isCorrect,
  false,
);
assert.equal(
  readMainQuizResponseAnswer(
    { selected_answer: "TRUE", correct_answer: "true" },
    0,
  ).isCorrect,
  true,
);
assert.equal(
  readMainQuizResponseAnswer({ selected_answer: "answer" }, 0).isCorrect,
  null,
);
const personalized = [
  { question: "Student A question", correct_answer: "A" },
  { question: "Student B question", correct_answer: "B" },
];
assert.equal(readMainQuizResponseAnswer(personalized[1], 0).correct, "B");
console.log(
  "Main quiz response handles missing answers, boolean answers, recorded grading, and personalized keys.",
);
