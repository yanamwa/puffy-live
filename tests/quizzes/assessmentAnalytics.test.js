import assert from "node:assert/strict";
import { summarizeAssessment } from "../../src/utils/assessmentAnalytics.js";
const students = [
  { user_id: 1, student_name: "Maomao" },
  { user_id: 2, student_name: "Jinshi" },
];
const items = [
  {
    question: "Recall API",
    topic: "API Basics",
    cognitive_level: "Remember",
    thinking_skill: "LOTS",
  },
  {
    question: "Analyze security",
    topic: "API Security",
    cognitive_level: "Analyze",
    thinking_skill: "HOTS",
  },
];
const attempts = [55, 85, 80].map((score, i) => ({
  user_id: 1,
  score,
  total: 100,
  answers: [
    { question: "Recall API", isCorrect: true },
    { question: "Analyze security", isCorrect: i > 0 },
  ],
}));
const result = summarizeAssessment(attempts, students, items);
assert.equal(result.attempts, 3);
assert.equal(result.students[0].attempts, 3);
assert.ok(Math.abs(result.students[0].first - 55) < 0.000001);
assert.equal(result.students[0].latest, 80);
assert.equal(result.students[0].best, 85);
assert.equal(result.students[1].first, null);
assert.equal(result.topics[0].percent, 100);
assert.equal(
  Math.round(result.cognitive.find((r) => r.label === "HOTS").percent),
  67,
);
assert.equal(result.questions[1].responses, 3);
assert.equal(summarizeAssessment([], students, items).average, null);
assert.equal(
  summarizeAssessment([{ user_id: 1, score: 0, total: 20 }], students, items)
    .average,
  0,
);
assert.equal(
  summarizeAssessment([{ user_id: 1, score: 10, total: 20 }], students, items)
    .questions.length,
  0,
);
console.log("Assessment aggregation checks passed.");
assert.equal(
  summarizeAssessment([{ user_id: 1, score: 5, total: 10 }], [], []).students[0]
    .name,
  "Unavailable account (ID 1)",
);
