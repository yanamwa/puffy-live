import test from "node:test";
import assert from "node:assert/strict";
import {
  assessmentModules,
  filterModuleAttempts,
} from "../../src/utils/assessmentModuleScope.js";
import { summarizeAssessment } from "../../src/utils/assessmentAnalytics.js";
const modules = [
  { id: "uuid-a", lesson_id: 51, title: "First" },
  { id: "uuid-b", lesson_id: 52, title: "Second" },
];
const attempts = [
  {
    user_id: 1,
    module_index: 0,
    assessment_type: "practice",
    score: 1,
    total: 1,
    answers: [{ question: "Same question", isCorrect: true }],
  },
  {
    user_id: 1,
    module_index: 1,
    assessment_type: "practice",
    score: 0,
    total: 1,
    answers: [{ question: "Same question", isCorrect: false }],
  },
  {
    user_id: 2,
    module_index: 1,
    assessment_type: "main",
    score: 1,
    total: 1,
    answers: [],
  },
  {
    user_id: 3,
    lesson_id: 51,
    assessment_type: "practice",
    score: 1,
    total: 1,
    answers: [],
  },
  { user_id: 4, assessment_type: "practice", score: 0, total: 1, answers: [] },
];
test("module selection separates practice and main attempts, including index zero", () => {
  assert.deepEqual(filterModuleAttempts(attempts, "0", modules), [
    attempts[0],
    attempts[3],
  ]);
  assert.deepEqual(filterModuleAttempts(attempts, "1", modules), [
    attempts[1],
    attempts[2],
  ]);
  assert.equal(filterModuleAttempts(attempts, "all", modules), attempts);
  assert.deepEqual(filterModuleAttempts(attempts, "99", modules), []);
});
test("statistics do not mix identical questions across modules", () => {
  const summary = (index) =>
    summarizeAssessment(
      filterModuleAttempts(attempts, index, modules).filter(
        (a) => a.assessment_type === "practice",
      ),
      [],
      [],
    );
  assert.equal(summary("0").average, 100);
  assert.equal(summary("1").average, 0);
  assert.equal(summary("0").questions[0].percent, 100);
  assert.equal(summary("1").questions[0].percent, 0);
});
test("module lists accept stored JSON and reject malformed data", () => {
  assert.deepEqual(
    assessmentModules({ content_modules: JSON.stringify(modules) }),
    modules,
  );
  assert.deepEqual(assessmentModules({ content_modules: "bad" }), []);
});
