const mean = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
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
export function summarizeAssessment(attempts, students, items) {
  const progress = new Map(
    students.map((s) => [
      String(s.user_id ?? s.userId ?? s.id),
      { name: s.student_name || s.name || `Student ${s.user_id ?? s.userId ?? s.id}`, scores: [] },
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
    const key = String(attempt.user_id);
    if (!progress.has(key))
      progress.set(key, {
        name: attempt.student_name || `Unavailable account (ID ${key})`,
        scores: [],
      });
    if (attempt.score != null && Number.isFinite(Number(attempt.score)) && Number(attempt.total) > 0) {
      const score = (Number(attempt.score) / Number(attempt.total)) * 100;
      progress.get(key).scores.push(score);
      scores.push(score);
    }
    for (const answer of attempt.answers || []) {
      const text = answer.question || answer.prompt || "";
      const item = items.find((q) => (q.question || q.q) === text) || {};
      const rawLevel =
        answer.cognitive_level ||
        item.cognitive_level ||
        item.cognitiveLevel ||
        "";
      const level =
        String(rawLevel).trim().toLowerCase() === "unclassified"
          ? "Not specified"
          : rawLevel || "Not specified";
      const rawSkill = answer.thinking_skill || item.thinking_skill || "";
      const skill =
        String(rawSkill).trim().toLowerCase() === "unclassified"
          ? skillOf(level)
          : rawSkill || skillOf(level);
      const rawTopic = answer.topic || item.topic || answer.topics || item.topics;
      const topic = normalizeTopic(
        Array.isArray(rawTopic) ? rawTopic.filter(Boolean).join(", ") : rawTopic,
      );
      const questionKey = `${attempt.lesson_id || ""}:${attempt.module_index ?? ""}:${text}`;
      const correct = answer.isCorrect ?? answer.is_correct;
      if (!text || ![true, false, 0, 1, "true", "false"].includes(correct))
        continue;
      dataQuality.scoredResponses++;
      const rawTopicLabel = Array.isArray(rawTopic)
        ? rawTopic.filter(Boolean).join(", ").trim()
        : String(rawTopic ?? "").trim();
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
      if ([true, 1, "true"].includes(correct)) q.correct++;
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
