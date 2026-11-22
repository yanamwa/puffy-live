import test from "node:test";
import assert from "node:assert/strict";
import {
  assessmentModules,
  attemptModuleTitle,
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
test("student practice history contains the scored attempts behind the selected module average", () => {
  const submitted = [
    ...attempts,
    { ...attempts[0], score: 0 },
    { ...attempts[0], score: null },
    { ...attempts[0], total: 0 },
    { ...attempts[0], assessment_type: "recap" },
  ];
  const scoped = filterModuleAttempts(submitted, "0", modules).filter((row) => row.assessment_type === "practice");
  const student = summarizeAssessment(scoped, [], []).students.find((row) => row.id === "1");
  assert.deepEqual(student.attemptHistory.map((row) => row.score), [1, 0]);
  assert.equal(student.attempts, student.attemptHistory.length);
  assert.equal(student.average, 50);
  assert.equal(attemptModuleTitle(attempts[0], modules), "First");
  assert.equal(attemptModuleTitle(attempts[1], modules), "Second");
  assert.equal(attemptModuleTitle(attempts[3], modules), "First");
  assert.equal(attemptModuleTitle(attempts[4], modules), "Module unavailable");
});
test("module lists accept stored JSON and reject malformed data", () => {
  assert.deepEqual(
    assessmentModules({ content_modules: JSON.stringify(modules) }),
    modules,
  );
  assert.deepEqual(assessmentModules({ content_modules: "bad" }), []);
});
