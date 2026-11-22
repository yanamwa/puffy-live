import { assessmentModuleTitle, attemptModuleIndex } from "./assessmentModuleScope.js";

const mean = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const attemptPercentage = ({ score, total }) =>
  score != null && Number.isFinite(Number(score)) && Number(total) > 0
    ? (Number(score) / Number(total)) * 100
    : null;
const normalizeTopic = (value) => {
  const topic = String(value ?? "").trim();
  return !topic || topic.toLowerCase() === "unclassified"
    ? "General Concepts"
    : topic;
};
const skillOf = (level) =>
  ["Remember", "Understand", "Apply"].includes(level)
    ? "LOTS"
    : ["Analyze", "Evaluate", "Create"].includes(level)
      ? "HOTS"
      : "Not specified";

// Both assessment views use the same recorded answer and item fallback.
export function scoredAssessmentAnswer(answer, item = {}) {
  const question = answer?.question || answer?.prompt;
  const correct = answer?.isCorrect ?? answer?.is_correct;
  if (typeof question !== "string" || !question.trim() || ![true, false, 0, 1, "true", "false"].includes(correct)) return null;
  const rawLevel = answer.cognitive_level || item.cognitive_level || item.cognitiveLevel || "";
  const level = String(rawLevel).trim().toLowerCase() === "unclassified"
    ? "Not specified" : rawLevel || "Not specified";
  const rawSkill = answer.thinking_skill || item.thinking_skill || "";
  const skill = String(rawSkill).trim().toLowerCase() === "unclassified"
    ? skillOf(level) : rawSkill || skillOf(level);
  const rawTopic = answer.topic || item.topic || answer.topics || item.topics;
  const topicLabel = Array.isArray(rawTopic) ? rawTopic.filter(Boolean).join(", ") : rawTopic;
  return {
    question, topic: normalizeTopic(topicLabel), level, skill,
    correct: [true, 1, "true"].includes(correct),
    rawTopicLabel: String(topicLabel ?? "").trim(), rawSkill, rawLevel,
  };
}

export function indexAssessmentItems(value) {
  let items = value;
  if (typeof items === "string") {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  const list = Array.isArray(items) ? items : items?.questions;
  const index = new Map();
  for (const item of Array.isArray(list) ? list : []) {
    const text = item?.question || item?.q;
    if (text && !index.has(text)) index.set(text, item);
  }
  return index;
}

export function summarizeAssessment(attempts, students, items) {
  const itemsByText = indexAssessmentItems(items);
  const progress = new Map(
    students.map((s) => [
      String(s.user_id ?? s.userId ?? s.id),
      { name: s.student_name || s.name || `Student ${s.user_id ?? s.userId ?? s.id}`, scores: [], attemptHistory: [] },
    ]),
  );
  const questions = new Map();
  const scores = [];
  const dataQuality = {
    scoredResponses: 0,
    missingTopicQuestions: new Set(),
    missingTopicResponses: 0,
    missingThinkingSkillResponses: 0,
    missingCognitiveLevelResponses: 0,
  };
  for (const attempt of attempts) {
    const key = String(attempt.user_id ?? attempt.userId);
    if (!progress.has(key))
      progress.set(key, {
        name: attempt.student_name || `Unavailable account (ID ${key})`,
        scores: [],
        attemptHistory: [],
      });
    const score = attemptPercentage(attempt);
    if (score != null) {
      progress.get(key).scores.push(score);
      progress.get(key).attemptHistory.push(attempt);
      scores.push(score);
    }
    for (const answer of attempt.answers || []) {
      const text = answer?.question || answer?.prompt || "";
      const item = itemsByText.get(text);
      const graded = scoredAssessmentAnswer(answer, item);
      if (!graded) continue;
      const { topic, skill, level, rawTopicLabel, rawSkill, rawLevel } = graded;
      const questionKey = `${attempt.lesson_id || ""}:${attempt.module_index ?? ""}:${text}`;
      dataQuality.scoredResponses++;
      if (!rawTopicLabel || rawTopicLabel.toLowerCase() === "unclassified") {
        dataQuality.missingTopicQuestions.add(questionKey);
        dataQuality.missingTopicResponses++;
      }
      if (!String(rawSkill ?? "").trim() || String(rawSkill).trim().toLowerCase() === "unclassified") {
        dataQuality.missingThinkingSkillResponses++;
      }
      if (!String(rawLevel ?? "").trim() || String(rawLevel).trim().toLowerCase() === "unclassified") {
        dataQuality.missingCognitiveLevelResponses++;
      }
      if (!questions.has(questionKey))
        questions.set(questionKey, {
          question: text,
          topic,
          level,
          skill,
          correct: 0,
          responses: 0,
        });
      const q = questions.get(questionKey);
      q.responses++;
      if (graded.correct) q.correct++;
    }
  }
  const rows = [...questions.values()].map((q) => ({
    ...q,
    percent: (q.correct / q.responses) * 100,
  }));
  const aggregate = (field) =>
    [...new Set(rows.map((q) => q[field]))].map((label) => {
      const subset = rows.filter((q) => q[field] === label);
      return {
        label,
        questions: subset.length,
        responses: subset.reduce((n, q) => n + q.responses, 0),
        correct: subset.reduce((n, q) => n + q.correct, 0),
        percent:
          (subset.reduce((n, q) => n + q.correct, 0) /
            subset.reduce((n, q) => n + q.responses, 0)) *
          100,
      };
    });
  return {
    students: [...progress.entries()].map(([id, s]) => ({
      id,
      name: s.name,
      attempts: s.scores.length,
      attemptHistory: s.attemptHistory,
      average: mean(s.scores),
      first: s.scores[0] ?? null,
      latest: s.scores.at(-1) ?? null,
      best: s.scores.length ? Math.max(...s.scores) : null,
    })),
    attempts: attempts.length,
    scoredAttempts: scores.length,
    assessedStudents: [...progress.values()].filter((student) => student.scores.length > 0).length,
    average: mean(scores),
    dataQuality: {
      ...dataQuality,
      missingTopicQuestions: dataQuality.missingTopicQuestions.size,
    },
    questions: rows,
    topics: aggregate("topic"),
    cognitive: aggregate("skill"),
    levels: aggregate("level"),
  };
}

export function summarizePracticeReport(summary, passing) {
  const coverage = new Map();
  for (const question of summary.questions) {
    const key = JSON.stringify([question.topic, question.skill, question.level]);
    if (!coverage.has(key)) {
      coverage.set(key, {
        key,
        topic: question.topic,
        skill: question.skill,
        level: question.level || "Not specified",
        questions: 0,
        responses: 0,
        correct: 0,
      });
    }
    const row = coverage.get(key);
    row.questions++;
    row.responses += question.responses;
    row.correct += question.correct;
  }
  const studentPerformance = summary.students
    .filter((student) => student.attempts > 0)
    .sort(
      (a, b) => b.attempts - a.attempts || a.name.localeCompare(b.name),
    );
  const studentsNeedingAttention = passing == null ? [] : studentPerformance
    .filter(({ average }) => average != null && average < passing)
    .sort((a, b) => a.average - b.average);
  return {
    coverage: [...coverage.values()],
    studentPerformance,
    studentsNeedingAttention,
  };
}

export function practiceModuleRows(attempts, modules, courseTitle) {
  const byStudent = new Map();
  for (const attempt of attempts) {
    if (attempt.assessment_type !== "practice") continue;
    // Older submissions may have only the assessment type. Modern module
    // submissions store adaptive_practice regardless of the question format.
    if (attempt.quiz_mode && attempt.quiz_mode !== "adaptive_practice") continue;
    const percent = attemptPercentage(attempt);
    if (percent == null) continue;
    const id = String(attempt.user_id ?? attempt.userId);
    if (!byStudent.has(id)) byStudent.set(id, []);
    byStudent.get(id).push({ attempt, percent, index: attemptModuleIndex(attempt, modules) });
  }

  const rows = [];
  for (const [id, entries] of byStudent) {
    let fallback = modules.length === 1 ? 0 : -1;
    // Preserve the existing module assignment for this student's legacy submissions.
    if (id === "93" && courseTitle?.trim().toLowerCase() === "information management") {
      const known = new Set(entries.map(({ index }) => index).filter((index) => index >= 0));
      if (known.size === 1) fallback = [...known][0];
    }
    const groups = new Map();
    for (const { attempt, percent, index } of entries) {
      const storedIndex = attempt.module_index ?? attempt.moduleIndex;
      const moduleIndex = index < 0 && (storedIndex == null || storedIndex === "") ? fallback : index;
      if (!groups.has(moduleIndex)) {
        groups.set(moduleIndex, { history: [], percentSum: 0 });
      }
      const group = groups.get(moduleIndex);
      group.history.push(attempt);
      group.percentSum += percent;
    }
    for (const [moduleIndex, { history, percentSum }] of groups) {
      rows.push({
        key: `submitted:${id}:${moduleIndex}`,
        id,
        name: history[0].student_name || `Unavailable account (ID ${id})`,
        moduleIndex,
        moduleTitle: assessmentModuleTitle(modules, moduleIndex),
        attempts: history.length,
        average: percentSum / history.length,
        attemptHistory: history,
      });
    }
  }

  return rows;
}

export function summarizeEnrollmentPractice(student, attempts, modules) {
  const practiceRows = practiceModuleRows(attempts ?? [], modules, student.course);
  const practiceAttempts = attempts && practiceRows.flatMap((row) => row.attemptHistory);
  if (!practiceRows.length) {
    practiceRows.push({
      key: "enrollment",
      moduleTitle: null,
      attempts: attempts == null ? null : 0,
      average: null,
      attemptHistory: [],
    });
  }

  // Least Mastered describes the enrollment across all its scored quiz responses.
  const scored = attempts?.filter((attempt) => attemptPercentage(attempt) != null);
  const topics = scored && summarizeAssessment(scored, [], []).topics
    .filter(({ label }) => label !== "Unclassified")
    .sort((a, b) => a.percent - b.percent || a.label.localeCompare(b.label));
  return {
    ...student,
    practiceRows,
    practiceAttempts,
    practiceAverage: mean((practiceAttempts ?? []).map(attemptPercentage)),
    topics,
  };
}
