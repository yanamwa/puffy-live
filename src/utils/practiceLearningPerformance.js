import {
  indexAssessmentItems,
  scoredAssessmentAnswer,
} from "./assessmentAnalytics.js";
import {
  assessmentModuleTitle,
  attemptModuleIndex,
} from "./assessmentModuleScope.js";

export const practiceReviewCriteria = {
  minStudents: 5,
  minResponses: 5,
  accuracy: 50,
};
const bloomLevels = [
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create",
];
const thinkingSkills = ["LOTS", "HOTS"];

function groupBy(rows, keyOf) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function addCounts(students, id, correct, responses) {
  if (!students.has(id)) students.set(id, { correct: 0, responses: 0 });
  const counts = students.get(id);
  counts.correct += correct;
  counts.responses += responses;
}

function summarizeQuestions(questions) {
  const students = new Map();
  let correct = 0;
  let responses = 0;
  for (const question of questions) {
    for (const [id, counts] of question.students) {
      addCounts(students, id, counts.correct, counts.responses);
      correct += counts.correct;
      responses += counts.responses;
    }
  }
  const scores = Array.from(
    students.values(),
    (s) => (100 * s.correct) / s.responses,
  );
  return {
    students: students.size,
    responses,
    correct,
    questions: new Set(questions.map((q) => q.identity)).size,
    accuracy: scores.length
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null,
    below: scores.length
      ? (100 *
          scores.filter((score) => score < practiceReviewCriteria.accuracy)
            .length) /
        scores.length
      : null,
  };
}

function topicStatus({ students, responses, accuracy }) {
  const criteria = practiceReviewCriteria;
  if (students < criteria.minStudents || responses < criteria.minResponses)
    return "insufficient";
  return accuracy < criteria.accuracy ? "review" : "onTrack";
}

function categoryRows(questions, field, labels) {
  const groups = groupBy(questions, (question) => question[field]);
  return [...new Set([...labels, ...groups.keys()])].map((label) => ({
    label,
    ...summarizeQuestions(groups.get(label) ?? []),
  }));
}

function recordedOrder(a, b) {
  const time = Date.parse(a.created_at) - Date.parse(b.created_at);
  return time || Number(a.attempts_id) - Number(b.attempts_id) || 0;
}

export function summarizePracticeLearning(
  attempts,
  modules,
  items,
  firstOnly = false,
) {
  const courseItems = indexAssessmentItems(items);
  const moduleItems = modules.map((module) =>
    indexAssessmentItems(module.quizItems ?? module.quiz_items),
  );
  const questions = new Map();
  const firstSessions = new Set();
  let unlinkedAttempts = 0;
  const scored = attempts.filter(
    (attempt) =>
      attempt.assessment_type === "practice" &&
      attempt.score != null &&
      attempt.score !== "" &&
      Number.isFinite(Number(attempt.score)) &&
      Number(attempt.total) > 0,
  );
  if (firstOnly) scored.sort(recordedOrder);
  for (const attempt of scored) {
    const user = attempt.user_id ?? attempt.userId;
    if (user == null || user === "") continue;
    const student = String(user);
    const stored = attempt.module_index ?? attempt.moduleIndex;
    const moduleIndex =
      stored == null || stored === ""
        ? attemptModuleIndex(attempt, modules)
        : Number(stored);
    const linked = Number.isInteger(moduleIndex) && moduleIndex >= 0;
    const moduleKey = linked
      ? moduleIndex
      : `unlinked:${attempt.lesson_id ?? attempt.lessonId ?? ""}`;
    if (firstOnly) {
      if (!linked) {
        unlinkedAttempts++;
        continue;
      }
      const session = JSON.stringify([student, moduleKey]);
      if (firstSessions.has(session)) continue;
      // A score-only first session still precedes any later session with question details.
      firstSessions.add(session);
    }
    for (const answer of Array.isArray(attempt.answers)
      ? attempt.answers
      : []) {
      const text = answer?.question || answer?.prompt;
      const item = moduleItems[moduleIndex]?.get(text) ?? courseItems.get(text);
      const graded = scoredAssessmentAnswer(answer, item);
      if (!graded) continue;
      const level =
        bloomLevels.find(
          (name) =>
            name.toLowerCase() === String(graded.level).trim().toLowerCase(),
        ) ?? graded.level;
      const skill =
        thinkingSkills.find(
          (name) => name === String(graded.skill).trim().toUpperCase(),
        ) ?? graded.skill;
      const topic = graded.topic.replace(/\s+/g, " ");
      const topicKey = JSON.stringify([moduleKey, topic.toLowerCase()]);
      const identity = JSON.stringify([
        moduleKey,
        answer.question_id ?? answer.questionId ?? text.trim(),
      ]);
      // Keep the recorded wording visible if a saved question was later edited.
      const key = JSON.stringify([
        topicKey,
        identity,
        text.trim(),
        level,
        skill,
      ]);
      if (!questions.has(key)) {
        questions.set(key, {
          key,
          topicKey,
          identity,
          text,
          topic,
          level,
          skill,
          students: new Map(),
          moduleTitle:
            linked && !modules[moduleIndex]
              ? `Module ${moduleIndex + 1}`
              : assessmentModuleTitle(modules, moduleIndex),
        });
      }
      addCounts(
        questions.get(key).students,
        student,
        Number(graded.correct),
        1,
      );
    }
  }

  const entries = [...questions.values()];
  const topics = [];
  for (const [key, evidence] of groupBy(entries, (q) => q.topicKey)) {
    const stats = summarizeQuestions(evidence);
    const levels = Array.from(
      groupBy(evidence, (q) => JSON.stringify([q.level, q.skill])).values(),
      (rows) => ({
        label: rows[0].level,
        skill: rows[0].skill,
        ...summarizeQuestions(rows),
      }),
    );
    const rank = (label) =>
      bloomLevels.includes(label)
        ? bloomLevels.indexOf(label)
        : bloomLevels.length;
    levels.sort(
      (a, b) =>
        rank(a.label) - rank(b.label) ||
        a.label.localeCompare(b.label) ||
        a.skill.localeCompare(b.skill),
    );
    topics.push({
      key,
      label: evidence[0].topic,
      moduleTitle: evidence[0].moduleTitle,
      ...stats,
      status: topicStatus(stats),
      levels,
      evidence: evidence.map((q) => ({
        key: q.key,
        text: q.text,
        level: q.level,
        skill: q.skill,
        ...summarizeQuestions([q]),
      })),
    });
  }
  const order = { review: 0, onTrack: 1, insufficient: 2 };
  topics.sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      a.accuracy - b.accuracy ||
      a.label.localeCompare(b.label) ||
      a.moduleTitle.localeCompare(b.moduleTitle),
  );
  return {
    topics,
    unlinkedAttempts,
    skills: categoryRows(entries, "skill", thinkingSkills),
    levels: categoryRows(entries, "level", bloomLevels),
  };
}
