const mean = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const skillOf = (level) =>
  ["Remember", "Understand", "Apply"].includes(level)
    ? "LOTS"
    : ["Analyze", "Evaluate", "Create"].includes(level)
      ? "HOTS"
      : "Unclassified";
export function summarizeAssessment(attempts, students, items) {
  const progress = new Map(
    students.map((s) => [
      String(s.user_id ?? s.userId ?? s.id),
      { name: s.student_name || s.name || `Student ${s.user_id ?? s.userId ?? s.id}`, scores: [] },
    ]),
  );
  const questions = new Map();
  const scores = [];
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
      const level =
        answer.cognitive_level ||
        item.cognitive_level ||
        item.cognitiveLevel ||
        "";
      const skill =
        answer.thinking_skill || item.thinking_skill || skillOf(level);
      const topic = answer.topic || item.topic || "Unclassified";
      const questionKey = `${attempt.lesson_id || ""}:${attempt.module_index ?? ""}:${text}`;
      const correct = answer.isCorrect ?? answer.is_correct;
      if (!text || ![true, false, 0, 1, "true", "false"].includes(correct))
        continue;
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
    average: mean(scores),
    questions: rows,
    topics: aggregate("topic"),
    cognitive: aggregate("skill"),
    levels: aggregate("level"),
  };
}
