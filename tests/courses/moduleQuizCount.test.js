import test from "node:test";
import assert from "node:assert/strict";
import { countModuleQuizzes } from "../../src/utils/moduleQuizCount.js";

const questions = Array.from({ length: 5 }, (_, i) => ({
  question: `Question ${i + 1}`,
}));

test("30 questions across six modules count as six module quizzes", () => {
  const contentModules = Array.from({ length: 6 }, (_, i) => ({
    id: `module-${i}`,
    quizItems: questions,
  }));
  assert.equal(countModuleQuizzes({ contentModules, quizzes: 30 }), 6);
});

test("empty and deleted module quizzes do not inherit stale course totals", () => {
  const course = {
    quizzes: 30,
    quizItems: questions,
    contentModules: [
      { quizItems: questions },
      { quizItems: [] },
      { quizItems: [{ question: " " }, null, {}] },
    ],
  };
  assert.equal(countModuleQuizzes(course), 1);
  assert.equal(
    countModuleQuizzes({ ...course, contentModules: [{ quizItems: [] }] }),
    0,
  );
  assert.equal(countModuleQuizzes({ quizzes: 30, quizItems: questions }), 0);
  assert.equal(
    countModuleQuizzes({
      contentModules: [],
      quizItems: questions.map((item) => ({ ...item, moduleIndex: 0 })),
      quizzes: 30,
    }),
    0,
  );
});

test("JSON and legacy module metadata count quizzes without counting individual questions", () => {
  assert.equal(
    countModuleQuizzes({
      content_modules: JSON.stringify([
        { quiz_contents: JSON.stringify(questions) },
        { quiz_items: questions },
      ]),
    }),
    2,
  );
  assert.equal(
    countModuleQuizzes({
      quizModule: JSON.stringify([
        ...questions.map((item) => ({ ...item, module_index: 0 })),
        ...questions.map((item) => ({ ...item, module_index: 1 })),
        ...questions,
      ]),
    }),
    2,
  );
  assert.equal(
    countModuleQuizzes({ content_modules: "invalid", quizzes: 30 }),
    0,
  );
});
