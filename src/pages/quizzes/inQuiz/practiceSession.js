export function readStorageJson(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
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
