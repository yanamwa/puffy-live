import assert from "node:assert/strict";
import test from "node:test";
import { summarizePracticeLearning } from "../../src/utils/practiceLearningPerformance.js";

const modules = [
  { title: "Database foundations", lesson_id: 22 },
  { title: "Database design" },
];
const answer = (correct, level = "Remember") => ({
  question: `Question for ${level}`,
  topic: "Database roles",
  cognitive_level: level,
  isCorrect: correct,
});
const session = (student, answers, overrides = {}) => ({
  assessment_type: "practice",
  module_index: 0,
  attempts_id: student,
  user_id: student,
  score: answers.filter((a) => a.isCorrect).length,
  total: answers.length,
  answers,
  ...overrides,
});

test("retakes count toward the served mix while each student has equal weight in a topic", () => {
  const attempts = [
    session(
      1,
      Array.from({ length: 10 }, () => answer(false, "Analyze")),
    ),
    ...[2, 3, 4, 5].map((id) => session(id, [answer(true)])),
    session(2, [answer(true, "Analyze")], { attempts_id: 6 }),
  ];
  const { topics, skills, levels } = summarizePracticeLearning(
    attempts,
    modules,
    [],
  );
  assert.equal(topics.length, 1);
  const [topic] = topics;
  assert.equal(topic.accuracy, 80);
  assert.equal(topic.below, 20);
  assert.equal(topic.status, "onTrack");
  assert.equal(topic.students, 5);
  assert.equal(topic.responses, 15);
  assert.equal(topic.questions, 2);
  assert.deepEqual(
    topic.levels.map((l) => [l.label, l.skill, l.students]),
    [
      ["Remember", "LOTS", 4],
      ["Analyze", "HOTS", 2],
    ],
  );
  assert.deepEqual(
    skills.map((r) => r.responses),
    [4, 11],
  );
  assert.equal(levels.find((r) => r.label === "Analyze").accuracy, 50);
  assert.equal(levels.find((r) => r.label === "Create").accuracy, null);
  assert.equal(
    topic.evidence.reduce((n, q) => n + q.responses, 0),
    topic.responses,
  );
  assert.equal(
    topic.evidence.reduce((n, q) => n + q.correct, 0),
    topic.correct,
  );
});

test("topic labels use distinct participants and the inclusive 50% boundary", () => {
  const topicsFor = (attempts) =>
    summarizePracticeLearning(attempts, modules, []).topics;
  const exactlyHalf = [1, 2, 3, 4, 5].map((id) =>
    session(id, [answer(false), answer(true, "Apply")]),
  );
  assert.equal(topicsFor(exactlyHalf)[0].status, "onTrack");
  const below = [
    ...exactlyHalf.slice(1),
    session(1, [answer(false), answer(false, "Apply")]),
  ];
  assert.equal(topicsFor(below)[0].status, "review");
  assert.equal(topicsFor(below.slice(1))[0].status, "insufficient");
  assert.equal(
    topicsFor(Array(8).fill(exactlyHalf[0]))[0].status,
    "insufficient",
  );
  assert.equal(
    topicsFor([session(1, [answer(true)])])[0].status,
    "insufficient",
  );
});

test("first attempts select a whole scored session per student and module, including score-only history", () => {
  const attempts = [
    session(1, [answer(true)], { attempts_id: 4, created_at: "2026-10-11" }),
    session(1, [answer(false), answer(false, "Apply")], {
      attempts_id: 1,
      module_index: null,
      lesson_id: 22,
      created_at: "2026-10-01",
    }),
    session(1, [answer(true)], { attempts_id: 2, module_index: 1 }),
    session(2, [], { attempts_id: 3, total: 10, score: 5 }),
    session(2, [answer(true)], { attempts_id: 5, created_at: "2026-10-12" }),
    session(3, [answer(true)], { attempts_id: 6, module_index: null }),
    session(4, [answer(true)], { assessment_type: "main" }),
    session(5, [answer(true)], { score: null }),
  ];
  const first = summarizePracticeLearning(attempts, modules, [], true);
  assert.equal(first.unlinkedAttempts, 1);
  assert.deepEqual(
    first.topics.map((r) => [
      r.moduleTitle,
      r.students,
      r.responses,
      r.accuracy,
    ]),
    [
      ["Database foundations", 1, 2, 0],
      ["Database design", 1, 1, 100],
    ],
  );
  const all = summarizePracticeLearning(attempts, modules, []);
  assert.equal(all.topics.length, 3);
  assert.equal(all.skills[0].responses, 6);
});

test("historical answers use their module item metadata and omit unscored interactions", () => {
  const question = {
    question: "Name the role",
    topic: "Roles",
    cognitive_level: "Remember",
  };
  const courseModules = [
    { quizItems: [question] },
    {
      quiz_items: [
        { ...question, topic: "Access", cognitive_level: "Analyze" },
      ],
    },
  ];
  const attempts = [
    session(1, [{ prompt: question.question, is_correct: 0 }]),
    session(1, [{ prompt: question.question, is_correct: true }], {
      module_index: 1,
    }),
    session(1, [
      { prompt: "Unclassified question", isCorrect: false },
      { prompt: "Opened flashcard" },
    ]),
  ];
  const report = summarizePracticeLearning(attempts, courseModules, []);
  assert.deepEqual(
    report.skills.map((s) => [s.label, s.responses]),
    [
      ["LOTS", 1],
      ["HOTS", 1],
      ["Not specified", 1],
    ],
  );
  assert.equal(
    report.topics.find((t) => t.label === "Access").levels[0].label,
    "Analyze",
  );
  assert.equal(
    report.levels.find((r) => r.label === "Not specified").responses,
    1,
  );
  assert.deepEqual(summarizePracticeLearning([], modules, []).topics, []);
});
