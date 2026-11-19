export function readStorageJson(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function coursePracticeModule(course, modules) {
  const hasPublication = modules.some((module) => module.studentPublished !== undefined);
  const visible = modules.filter((module) => !hasPublication || module.studentPublished === true);
  return {
    id: "all-modules",
    title: course.title || course.courseName || course.course_name || "Course practice",
    lessonPages: visible.flatMap((module) => module.lessonPages || []),
    quizItems: visible.flatMap((module) => module.quizItems || []),
  };
}

export function legacyPracticeRedirect(pathname, scope, storedLessonId) {
  const match = /^\/(flashcards-tutorial|QandA-tutorial|qna-tutorial|multipleChoice-tutorial|multiple-choice-tutorial|Matching-tutorial|matching-tutorial|timedquiz-tutorial|random-modes-tutorial|mixed-mode-tutorial|flashcard|qna|multiple-choice|matching-type|timedquiz|mixed-mode|random-modes|survival)\/lesson\/([^/]+)$/i.exec(pathname);
  if (!match || scope?.scopeType === "main_quiz") return "";
  let lessonId;
  try { lessonId = decodeURIComponent(match[2]); } catch { return ""; }
  if (storedLessonId !== lessonId) return "";
  const courseId = Number(scope?.courseId);
  if (!Number.isSafeInteger(courseId) || courseId < 1) return "";
  const moduleId = scope.scopeType === "course" ? "all-modules" : scope.scopeId;
  if (!moduleId) return `/student/enrolled-courses/${courseId}`;
  const route = match[1].toLowerCase();
  const mode = route.includes("flashcard") ? "flashcard"
    : /qna|qanda/.test(route) ? "qna"
    : route.includes("multiple") ? "multiple"
    : route.includes("matching") ? "matching"
    : route.includes("timed") ? "timed" : "mixed";
  return `/student/enrolled-courses/${courseId}/practice/${encodeURIComponent(moduleId)}?mode=${mode}`;
}

export function getStoredPracticeSession({ lessonId, deckId } = {}) {
  const source = String(window.localStorage.getItem("practiceSource") || "");
  const isDeckSource = source === "deck";
  const routeId = isDeckSource ? deckId : lessonId;

  if (!routeId) return null;

  const storedId = isDeckSource
    ? window.localStorage.getItem("practiceDeckId")
    : window.localStorage.getItem("practiceLessonId");

  if (storedId && String(storedId) !== String(routeId)) {
    return null;
  }

  const items = isDeckSource
    ? readStorageJson("practiceCards", [])
    : readStorageJson("practiceQuizzes", []);

  if (
    (!Array.isArray(items) || items.length === 0) &&
    readStorageJson("practiceScope", {})?.scopeType !== "main_quiz"
  ) {
    return null;
  }

  const mode = readStorageJson("practiceMode", null);
  const scope = readStorageJson("practiceScope", null);

  return {
    source: source || (isDeckSource ? "deck" : "lesson"),
    lessonId,
    deckId,
    routeId,
    items,
    mode,
    scope,
    title:
      scope?.scopeTitle ||
      mode?.title ||
      mode?.mode_name ||
      (isDeckSource ? "Deck Practice" : "Lesson Practice"),
  };
}

export function getPracticeTitle(session, fallback) {
  const scope = session?.scope || {};
  const title =
    scope.moduleTitle ||
    (scope.scopeType === "course"
      ? scope.courseTitle || scope.courseName
      : "") ||
    scope.scopeTitle ||
    session?.title ||
    fallback ||
    "Practice";

  return String(title).replace(/\s+main\s+quiz$/i, "").trim();
}

export function getPracticeResultMetadata(session, fallbackSource) {
  if (!session) {
    return {
      source: fallbackSource,
    };
  }

  return {
    source: session.source || fallbackSource,
    courseId: session.scope?.courseId || null,
    courseCode: session.scope?.courseCode || null,
    scopeId: session.scope?.scopeId || null,
    scopeType: session.scope?.scopeType || session.source || null,
    scopeTitle: session.scope?.scopeTitle || session.title || null,
    scopeDetail: session.scope?.scopeDetail || null,
    contentTitle: session.title || null,
    moduleIndex: session.scope?.moduleIndex ?? null,
    moduleNumber: session.scope?.moduleNumber ?? null,
    moduleCount: session.scope?.moduleCount ?? null,
    nextModuleIndex: session.scope?.nextModuleIndex ?? null,
    nextModuleTitle: session.scope?.nextModuleTitle || null,
  };
}

export function toNumericId(value) {
  return /^\d+$/.test(String(value || "")) ? Number(value) : null;
}

export function getResultPracticeModule(result, modules) {
  const moduleId =
    result.moduleId ??
    result.module_id ??
    result.scopeId ??
    result.scope?.scopeId;
  if (moduleId != null && String(moduleId).trim()) {
    // An explicit module must still exist; never silently select another one.
    return (
      modules.find((module) =>
        [module.id, module.module_id, module.lesson_id].some(
          (id) => id != null && String(id) === String(moduleId),
        ),
      ) || null
    );
  }
  const index =
    result.moduleIndex ?? result.module_index ?? result.scope?.moduleIndex;
  if (index != null && String(index).trim() !== "") {
    return Number.isInteger(Number(index))
      ? modules[Number(index)] || null
      : null;
  }
  return modules.length === 1 ? modules[0] : null;
}

export function getPracticeReviewPath(session, { lessonId, deckId } = {}) {
  if (session?.source === "deck") {
    return `/review/deck/${session.deckId || deckId}`;
  }

  return `/review/${session?.lessonId || lessonId}`;
}

export function getPracticeBackPath(session, { lessonId, deckId } = {}) {
  if (session?.scope?.courseId) {
    return `/student/enrolled-courses/${session.scope.courseId}`;
  }

  if (session?.source === "deck") {
    return `/review/deck/${session.deckId || deckId}`;
  }

  return `/learning/${session?.lessonId || lessonId}`;
}

export function getQuizItemQuestion(item, fallback = "No question available.") {
  return (
    item?.question ||
    item?.q ||
    item?.prompt ||
    item?.front ||
    item?.term ||
    item?.title ||
    fallback
  );
}

export function getQuizItemAnswer(item, fallback = "") {
  return (
    item?.correct_answer ||
    item?.correctAnswer ||
    item?.answer ||
    item?.correct ||
    item?.back ||
    item?.definition ||
    item?.description ||
    fallback
  );
}
