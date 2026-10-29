import assert from "node:assert/strict";
import { isMainQuizResult } from "../../src/utils/quizResultType.js";
assert.equal(
  isMainQuizResult({ scopeType: "main_quiz", source: "module" }),
  true,
);
assert.equal(isMainQuizResult({ scope: { scopeType: "main_quiz" } }), true);
assert.equal(isMainQuizResult({ assessment_type: "main" }), true);
assert.equal(
  isMainQuizResult({ scopeType: "practice_quiz", source: "module" }),
  false,
);
assert.equal(isMainQuizResult({ source: "deck" }), false);
assert.equal(isMainQuizResult({ source: "lesson", quizMode: "timed" }), false);
console.log(
  "Main quiz results are separated from practice, deck, and lesson reviews.",
);
