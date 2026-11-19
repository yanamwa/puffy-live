import assert from "node:assert/strict";
import test from "node:test";
import { getResultPracticeModule } from "../../src/pages/quizzes/inQuiz/practiceSession.js";

const modules = [
  { id: "database", lesson_id: 51 },
  { id: "architecture", lesson_id: 52 },
];

test("recap and legacy results retry the same module, including module zero", () => {
  for (const result of [
    { moduleId: "database", answers: Array(5).fill({}) },
    { scopeId: "database" },
    { moduleIndex: 0 },
    { scope: { moduleIndex: "0" } },
    { moduleId: 51 },
  ]) {
    assert.equal(getResultPracticeModule(result, modules), modules[0]);
  }
  assert.equal(
    getResultPracticeModule({ moduleIndex: 1 }, modules),
    modules[1],
  );
});

test("course-wide and removed-module results require a module selection", () => {
  for (const result of [
    {},
    { moduleId: "removed", moduleIndex: 0 },
    { moduleIndex: 99 },
    { moduleIndex: -1 },
  ])
    assert.equal(getResultPracticeModule(result, modules), null);
  assert.equal(getResultPracticeModule({}, [modules[0]]), modules[0]);
  assert.equal(getResultPracticeModule({}, []), null);
});
