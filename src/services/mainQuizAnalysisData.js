export function mainQuizKey(attempt) {
  return String(attempt.module_index ?? attempt.moduleIndex ?? 0);
}

export function mainQuizQuestionCount(attempts) {
  return Math.max(
    0,
    ...attempts.map((attempt) => {
      const total = Number(
        attempt.total ?? attempt.total_items ?? attempt.question_count,
      );
      return Number.isInteger(total) && total > 0
        ? total
        : attempt.answers?.length || 0;
    }),
  );
}

export function mainQuizAnswerAt(attempt, index) {
  const answers = Array.isArray(attempt?.answers) ? attempt.answers : [];
  const hasSourceOrder = answers.some((answer) =>
    Number.isInteger(answer?.source_question_index),
  );
  return hasSourceOrder
    ? answers.find((answer) => answer?.source_question_index === index)
    : answers[index];
}

export function mainQuizQuestions(attempts) {
  const count = mainQuizQuestionCount(attempts);
  return Array.from({ length: count }, (_, index) => {
    const answer =
      attempts
        .map((attempt) => mainQuizAnswerAt(attempt, index))
        .find(Boolean) || {};
    return {
      ...answer,
      question: answer.question || answer.prompt || `Question ${index + 1}`,
      attemptIndex: index,
      cognitiveLevel: answer.cognitive_level,
      thinkingSkill: answer.thinking_skill,
      cognitiveCategory: answer.thinking_skill,
    };
  });
}

export function summarizeMainQuizScores(attempts) {
  const scored = attempts.filter(
    (a) => Number.isFinite(a.score) && a.total > 0,
  );
  const totals = new Set(scored.map((a) => a.total));
  const mixedTotals = totals.size > 1;
  const scale = mixedTotals ? 100 : (scored[0]?.total ?? 0);
  const scores = scored
    .map((a) => (mixedTotals ? (100 * a.score) / a.total : a.score))
    .sort((a, b) => a - b);
  const n = scores.length;
  const mean = n ? scores.reduce((sum, score) => sum + score, 0) / n : null;
  const passed = scored.filter((a) => a.score >= a.passScore).length;
  return {
    scale,
    mixedTotals,
    averageScore: mean,
    medianScore: n
      ? (scores[Math.floor((n - 1) / 2)] + scores[Math.floor(n / 2)]) / 2
      : null,
    highestScore: scores.at(-1),
    lowestScore: scores[0],
    standardDeviation: n
      ? Math.sqrt(
          scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / n,
        )
      : null,
    passRate: n ? (100 * passed) / n : null,
    studentsPassed: passed,
    studentsFailed: n - passed,
    responseTotal: n,
  };
}
