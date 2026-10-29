import assert from "node:assert/strict";
import { distributeQuizQuestions } from "../../src/services/quizQuestionDistribution.js";
for (let total = 1; total <= 100; total++) {
  const counts = distributeQuizQuestions(total);
  assert.equal(
    counts.reduce((a, b) => a + b, 0),
    total,
  );
  assert.ok(counts.every((count) => Number.isInteger(count) && count >= 0));
  counts.forEach((count, index) =>
    assert.ok(Math.abs(count - total * [0.5, 0.25, 0.25][index]) < 1),
  );
}
assert.deepEqual(distributeQuizQuestions(20), [10, 5, 5]);
assert.deepEqual(distributeQuizQuestions(10), [5, 3, 2]);
assert.deepEqual(distributeQuizQuestions(100), [50, 25, 25]);
for (const invalid of [0, -1, 101, 2.5, NaN])
  assert.deepEqual(distributeQuizQuestions(invalid), [0, 0, 0]);
console.log(
  "Automatic question distribution checks passed for totals 1-100 and invalid inputs.",
);
