const text = (value) => (value == null ? "" : String(value));
export function readMainQuizResponseAnswer(answer, index) {
  answer =
    answer && typeof answer === "object" ? answer : { selected_answer: answer };
  const selected = text(
    answer.selected_answer ??
      answer.selectedAnswer ??
      answer.user_answer ??
      answer.userAnswer ??
      answer.selected ??
      answer.choice ??
      answer.student_answer ??
      answer.studentAnswer ??
      answer.response ??
      answer.value ??
      answer.answer,
  );
  const correct = text(
    answer.correct_answer ?? answer.correctAnswer ?? answer.correct_response,
  );
  const flag = answer.is_correct ?? answer.isCorrect;
  const isCorrect =
    flag === true || flag === 1 || flag === "true"
      ? true
      : flag === false || flag === 0 || flag === "false"
        ? false
        : selected && correct
          ? selected.trim().toLowerCase() === correct.trim().toLowerCase()
          : null;
  return {
    question: text(answer.question || answer.prompt || `Question ${index + 1}`),
    questionType: text(
      answer.type || answer.question_type || answer.questionType || "",
    ),
    selected,
    correct,
    isCorrect,
    options: Array.isArray(answer.options) ? answer.options.map(text) : [],
    explanation: text(answer.explanation),
  };
}
