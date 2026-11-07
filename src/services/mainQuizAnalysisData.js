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
