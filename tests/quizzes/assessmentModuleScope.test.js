import test from "node:test";
import assert from "node:assert/strict";
import {
  assessmentModules,
  attemptModuleTitle,
  filterModuleAttempts,
} from "../../src/utils/assessmentModuleScope.js";
import { practiceModuleRows, summarizeAssessment } from "../../src/utils/assessmentAnalytics.js";
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

test("module performance keeps equal titles distinct and preserves unresolved attempts", () => {
  const sameTitles = modules.map((module) => ({ ...module, title: "Review" }));
  const first = { ...attempts[0], score: 1, total: 2 };
  const history = [first, { ...first, score: 9, total: 10 }, { ...first, module_index: 1 },
    { ...first, module_index: null }, { ...first, module_index: 9 }];
  const rows = practiceModuleRows(history, sameTitles, "Databases");
  assert.deepEqual(rows.map((row) => [row.moduleIndex, row.moduleTitle, row.attempts, row.average]), [
    [0, "Review", 2, 70], [1, "Review", 1, 50], [-1, "Module unavailable", 2, 50],
  ]);
  assert.equal(new Set(rows.map((row) => row.key)).size, rows.length);
  const single = practiceModuleRows(history, [modules[0]], "Databases");
  assert.deepEqual(single.map((row) => [row.moduleIndex, row.attempts]), [[0, 3], [-1, 2]]);
});

test("the existing legacy module assignment stays limited to its student and course", () => {
  const entries = [93, 94].flatMap((user_id) => [
    { ...attempts[0], user_id }, { ...attempts[0], user_id, module_index: null },
  ]);
  const counts = (course) => practiceModuleRows(entries, modules, course)
    .map((row) => [row.id, row.moduleIndex, row.attempts]);
  assert.deepEqual(counts("Information Management"), [["93", 0, 2], ["94", 0, 1], ["94", -1, 1]]);
  assert.deepEqual(counts("Statistics"), [["93", 0, 1], ["93", -1, 1], ["94", 0, 1], ["94", -1, 1]]);
});
