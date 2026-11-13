import { API_BASE } from "../config.js";
import { readAccountQuizResult } from "../utils/quizStorage.js";
import { lessonAuthHeaders } from "./lessonAuth.js";

function normalizePracticeAnswer(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function getPracticeAcceptedAnswers(item) {
  const questionType = String(item?.type || "").toLowerCase();
  if (
    questionType &&
    !["identification", "qna", "qa", "short_answer"].includes(questionType)
  )
    return [];
  const fields = [
    "accepted_answers",
    "acceptedAnswers",
    "acceptable_answers",
    "acceptableAnswers",
    "answer_aliases",
    "answerAliases",
    "alternatives",
  ];
  const candidates = fields.flatMap((field) => {
    const value = item?.[field];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return value.split(/\r?\n/);
    return [];
  });
  const unique = new Map();
  candidates.forEach((candidate) => {
    if (typeof candidate !== "string") return;
    const value = candidate.trim();
    const normalized = normalizePracticeAnswer(value);
    if (normalized && !unique.has(normalized)) unique.set(normalized, value);
  });
  return [...unique.values()];
}

export function practiceAnswersMatch(answer, key, acceptedAnswers = []) {
  const normalizedAnswer = normalizePracticeAnswer(answer);
  if (!normalizedAnswer) return false;
  const keys = [
    ...(Array.isArray(key) ? key : [key]),
    ...(Array.isArray(acceptedAnswers) ? acceptedAnswers : []),
  ];
  return keys.some(
    (candidate) => normalizePracticeAnswer(candidate) === normalizedAnswer,
  );
}

export function buildPracticeChoiceOptions(item, items) {
  if (item.options.length) return item.options;
  const correct = item.correct_answer;
  const unique = new Map([[normalizePracticeAnswer(correct), correct]]);
  for (const other of items) {
    for (const candidate of [other.correct_answer, ...other.options]) {
      const normalized = normalizePracticeAnswer(candidate);
      if (normalized && !unique.has(normalized))
        unique.set(normalized, candidate);
      if (unique.size === 4) return [...unique.values()];
    }
  }
  return [...unique.values()];
}

export function practiceModuleId(module) {
  return String(
    module?.id ?? module?.module_id ?? module?.lesson_id ?? "",
  ).trim();
}

export function modulePracticePath(courseId, module, mode) {
  const numericCourseId = Number(courseId);
  const moduleId = practiceModuleId(module);
  if (
    !Number.isSafeInteger(numericCourseId) ||
    numericCourseId < 1 ||
    !moduleId
  ) {
    return "";
  }
  const path = `/student/enrolled-courses/${numericCourseId}/practice/${encodeURIComponent(moduleId)}`;
  return mode ? `${path}?mode=${encodeURIComponent(mode)}` : path;
}

export function readModuleRecapAnswers(courseId, moduleIndex, moduleId) {
  try {
    const recap = JSON.parse(
      readAccountQuizResult(
        `lessonQuizResults_${courseId}_module_${moduleIndex}`,
      ),
    );
    if (!recap?.total || !Array.isArray(recap.answers)) return [];
    if (recap.moduleId && String(recap.moduleId) !== moduleId) return [];
    return recap.answers.map(({ question, userAnswer }) => ({
      question,
      userAnswer,
    }));
  } catch {
    return [];
  }
}

export async function requestModulePractice(action, body) {
  const response = await fetch(`${API_BASE}/lessons/practice/${action}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...lessonAuthHeaders() },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    const error = new Error(
      data?.message || "Practice is temporarily unavailable. Please try again.",
    );
    error.code = data?.code;
    throw error;
  }
  return data;
}
