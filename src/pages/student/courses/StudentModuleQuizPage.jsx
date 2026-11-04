import Swal from "sweetalert2";
import { API_BASE } from "../../../config.js";
import { lessonAuthHeaders } from "../../../services/lessonAuth.js";
import { mainQuizScheduleState } from "../../../utils/mainQuizSchedule.js";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import ModeCard from "../../../components/quizmodes/ModeCard";
import StudentHeader from "../../../components/students/StudentHeader";
import StudentSidebar from "../../../components/students/StudentSidebar";
import { fetchQuizModes } from "../../../services/quizModeApi";
import { fetchCourse } from "../../../services/courseApi";
import { getCourseContentModules } from "../../course/courseContent";
import { readStorageJson } from "../../quizzes/inQuiz/practiceSession";

import "../home/StudentModuleQuizPage.css";

const MAIN_QUIZ_SETTINGS_STORAGE_KEY = "puffy-main-quiz-settings";
const COURSE_DRAFT_STORAGE_PREFIX = "puffy-course-builder-draft";
const PROFESSOR_COURSES_KEY = "professor-courses";

function resolveModeImage(mode) {
  const image = String(mode.image || "").trim();

  if (!image) return "/images/flashcard.png";
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith("/")) return image;

  return `/images/${image}`;
}

function getModeKind(mode) {
  const text = `${mode.kind || ""} ${mode.quizMode || ""} ${
    mode.title || ""
  } ${mode.mode_name || ""} ${mode.route || ""}`.toLowerCase();

  if (
    text.includes("mixed") ||
    text.includes("random") ||
    text.includes("survival")
  ) {
    return "mixed";
  }

  if (text.includes("timed")) return "timed";
  if (text.includes("multiple")) return "multiple";
  if (text.includes("matching")) return "matching";
  if (text.includes("q")) return "qna";

  return "flashcard";
}

const modeRouteFallbacks = {
  flashcard: "/flashcards-tutorial",
  qna: "/QandA-tutorial",
  multiple: "/multipleChoice-tutorial",
  matching: "/Matching-tutorial",
  timed: "/timedquiz-tutorial",
  mixed: "/random-modes-tutorial",
  survival: "/random-modes-tutorial",
};

function getModeRoute(mode, modeKind) {
  const route = String(mode.route || "").trim();
  return route || modeRouteFallbacks[modeKind] || modeRouteFallbacks.flashcard;
}

function buildPracticeRoute(route, source, id) {
  const cleanRoute = String(route || "").replace(/\/+$/, "");

  if (!cleanRoute) return "";
  if (!id) return cleanRoute;

  if (cleanRoute.includes(":lessonId")) {
    return cleanRoute.replace(":lessonId", encodeURIComponent(id));
  }

  if (cleanRoute.includes(":deckId")) {
    return cleanRoute.replace(":deckId", encodeURIComponent(id));
  }

  return `${cleanRoute}/${source === "deck" ? "deck" : "lesson"}/${encodeURIComponent(
    id,
  )}`;
}

function normalizeDateTimeLocal(value) {
  const text = String(value || "").trim();

  if (!text) return "";

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text)) {
    return text.slice(0, 16);
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) return "";

  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function formatDateTimeLabel(value) {
  const normalized = normalizeDateTimeLocal(value);

  if (!normalized) return "";

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function readMainQuizSettingsMap() {
  const mergedSettings = {};

  [sessionStorage, localStorage].forEach((storage) => {
    try {
      const saved = storage.getItem(MAIN_QUIZ_SETTINGS_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : {};

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        Object.assign(mergedSettings, parsed);
      }
    } catch {
      // Ignore malformed storage and keep checking other sources.
    }
  });

  return mergedSettings;
}

function readStorageJsonValues(key) {
  const values = [];

  [sessionStorage, localStorage].forEach((storage) => {
    try {
      const saved = storage.getItem(key);

      if (!saved) return;

      const parsed = JSON.parse(saved);

      if (parsed !== null && parsed !== undefined) {
        values.push(parsed);
      }
    } catch {
      // Ignore malformed storage.
    }
  });

  return values;
}

function collectStorageJsonByPrefix(prefix) {
  const values = [];

  [sessionStorage, localStorage].forEach((storage) => {
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);

        if (!key || !key.startsWith(prefix)) {
          continue;
        }

        const parsed = JSON.parse(storage.getItem(key) || "null");

        if (parsed && typeof parsed === "object") {
          values.push(parsed);
        }
      }
    } catch {
      // Ignore inaccessible storage.
    }
  });

  return values;
}

function parseSettingsObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function normalizeBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function parseList(value) {
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function makeLookupKeys(values) {
  return [
    ...new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .flatMap((key) => [key, key.toLowerCase()]),
    ),
  ];
}

function stripMainQuizSuffix(value) {
  return String(value || "")
    .replace(/\s+main\s+quiz$/i, "")
    .trim();
}

function getCourseLookupKeys(courseId, scope = {}) {
  return makeLookupKeys([
    courseId,
    scope.courseId,
    scope.courseCode,
    scope.course_code,
    scope.courseTitle,
    scope.course_title,
    scope.courseName,
    scope.course_name,
  ]);
}

function getModuleLookupKeys(scope = {}, routeModuleId = "") {
  const moduleIndex = Number(scope.moduleIndex);
  const hasModuleIndex = Number.isInteger(moduleIndex) && moduleIndex >= 0;
  const cleanModuleTitle = stripMainQuizSuffix(
    scope.moduleTitle || scope.scopeTitle,
  );

  return makeLookupKeys([
    routeModuleId,
    scope.scopeId,
    scope.moduleId,
    scope.module_id,
    scope.moduleTitle,
    cleanModuleTitle,
    scope.scopeTitle,
    hasModuleIndex ? String(moduleIndex) : "",
    hasModuleIndex ? String(moduleIndex + 1) : "",
    hasModuleIndex ? `module-${moduleIndex + 1}` : "",
    hasModuleIndex ? `module ${moduleIndex + 1}` : "",
  ]);
}

function getCourseSettingKeys(course = {}) {
  return makeLookupKeys([
    course?.id,
    course?.course_id,
    course?.code,
    course?.courseCode,
    course?.course_code,
    course?.title,
    course?.courseTitle,
    course?.course_title,
    course?.courseName,
    course?.course_name,
    course?.subject,
  ]);
}

function getModuleSettingKeys(module = {}, moduleIndex = 0) {
  return makeLookupKeys([
    module?.id,
    module?.module_id,
    module?.moduleId,
    module?.lesson_id,
    module?.title,
    stripMainQuizSuffix(module?.title),
    String(moduleIndex),
    String(moduleIndex + 1),
    `module-${moduleIndex + 1}`,
    `module ${moduleIndex + 1}`,
  ]);
}

function keysOverlap(left = [], right = []) {
  const rightSet = new Set(right);
  return left.some((key) => rightSet.has(key));
}

function getCourseContentModuleList(course = {}) {
  const modules = Array.isArray(course?.contentModules)
    ? course.contentModules
    : Array.isArray(course?.content_modules)
      ? course.content_modules
      : parseList(course?.content_modules);

  return Array.isArray(modules) ? modules : [];
}

function courseMatchesKeys(course = {}, courseKeys = []) {
  return keysOverlap(getCourseSettingKeys(course), courseKeys);
}

function hasExplicitMainQuizSettings(module = {}) {
  return (
    module.mainQuizSettings ||
    module.main_quiz_settings ||
    module.mainQuizEnabled !== undefined ||
    module.main_quiz_enabled !== undefined ||
    module.mainQuizUnlockAt ||
    module.main_quiz_unlock_at ||
    module.mainQuizLockAt ||
    module.main_quiz_lock_at
  );
}

function coerceMainQuizSettings(module = {}, override = null) {
  const settings = parseSettingsObject(
    override || module?.mainQuizSettings || module?.main_quiz_settings,
  );

  return {
    enabled: normalizeBoolean(
      settings.enabled ??
        settings.isEnabled ??
        module?.mainQuizEnabled ??
        module?.main_quiz_enabled,
      true,
    ),
    lockAt: normalizeDateTimeLocal(
      settings.lockAt ||
        settings.lock_at ||
        module?.mainQuizLockAt ||
        module?.main_quiz_lock_at,
    ),
    unlockAt: normalizeDateTimeLocal(
      settings.unlockAt ||
        settings.unlock_at ||
        module?.mainQuizUnlockAt ||
        module?.main_quiz_unlock_at,
    ),
  };
}

function readMainQuizSettingsOverride(
  courseId,
  scope = {},
  routeModuleId = "",
) {
  const settingsMap = readMainQuizSettingsMap();
  const courseLookupKeys = getCourseLookupKeys(courseId, scope);
  const moduleLookupKeys = getModuleLookupKeys(scope, routeModuleId);

  for (const courseKey of courseLookupKeys) {
    for (const moduleKey of moduleLookupKeys) {
      const settings = settingsMap[`${courseKey}::${moduleKey}`];

      if (settings && typeof settings === "object") {
        return settings;
      }
    }
  }

  return null;
}

function readStoredMainQuizSettingsOverride(
  courseId,
  scope = {},
  routeModuleId = "",
) {
  const courseKeys = getCourseLookupKeys(courseId, scope);
  const moduleKeys = getModuleLookupKeys(scope, routeModuleId);
  const courseCandidates = [];
  const seenCandidates = new Set();

  const addCourseCandidate = (candidate) => {
    if (!candidate || typeof candidate !== "object") {
      return;
    }

    const identity = JSON.stringify([
      candidate.id,
      candidate.course_id,
      candidate.code,
      candidate.title,
    ]);

    if (seenCandidates.has(identity)) {
      return;
    }

    seenCandidates.add(identity);
    courseCandidates.push(candidate);
  };

  courseKeys.forEach((courseKey) => {
    readStorageJsonValues(
      `${COURSE_DRAFT_STORAGE_PREFIX}:${courseKey}`,
    ).forEach(addCourseCandidate);
  });

  collectStorageJsonByPrefix(`${COURSE_DRAFT_STORAGE_PREFIX}:`).forEach(
    (draft) => {
      if (courseMatchesKeys(draft, courseKeys)) {
        addCourseCandidate(draft);
      }
    },
  );

  readStorageJsonValues(PROFESSOR_COURSES_KEY).forEach((savedCourses) => {
    if (!Array.isArray(savedCourses)) {
      return;
    }

    savedCourses.forEach((savedCourse) => {
      if (courseMatchesKeys(savedCourse, courseKeys)) {
        addCourseCandidate(savedCourse);
      }
    });
  });

  for (const candidateCourse of courseCandidates) {
    const candidateModule = getCourseContentModuleList(candidateCourse).find(
      (item, index) =>
        keysOverlap(getModuleSettingKeys(item, index), moduleKeys),
    );

    if (candidateModule && hasExplicitMainQuizSettings(candidateModule)) {
      return coerceMainQuizSettings(candidateModule);
    }
  }

  return null;
}

function getMainQuizLockReason(
  courseId,
  scope,
  routeModuleId,
  savedSettings = null,
) {
  if (scope?.scopeType !== "main_quiz") {
    return "";
  }

  const settings =
    savedSettings ||
    readMainQuizSettingsOverride(courseId, scope, routeModuleId) ||
    readStoredMainQuizSettingsOverride(courseId, scope, routeModuleId);

  if (!settings) {
    return "";
  }

  const scheduleState = mainQuizScheduleState({
    enabled: normalizeBoolean(settings.enabled ?? settings.isEnabled, true),
    lockAt: normalizeDateTimeLocal(settings.lockAt || settings.lock_at),
    unlockAt: normalizeDateTimeLocal(settings.unlockAt || settings.unlock_at),
  });
  if (scheduleState === "disabled") {
    return "Your professor has turned off the Main Quiz for this module.";
  }

  const lockAt = normalizeDateTimeLocal(settings.lockAt || settings.lock_at);
  if (scheduleState === "closed") {
    return `Main Quiz closed on ${formatDateTimeLabel(lockAt)}.`;
  }

  const unlockAt = normalizeDateTimeLocal(
    settings.unlockAt || settings.unlock_at,
  );
  if (scheduleState === "scheduled") {
    return `Main Quiz opens on ${formatDateTimeLabel(unlockAt)}.`;
  }

  return "";
}

export default function StudentModuleQuizPage() {
  const { courseId, quizType, moduleId } = useParams();
  const navigate = useNavigate();
  const [modes, setModes] = useState([]);
  const [loadingModes, setLoadingModes] = useState(true);
  const [savedQuizAccess, setSavedQuizAccess] = useState(null);
  const [checkingQuizAccess, setCheckingQuizAccess] = useState(true);
  const [quizAccessError, setQuizAccessError] = useState("");

  const scope = useMemo(() => readStorageJson("practiceScope", {}), []);
  const quizzes = useMemo(() => readStorageJson("practiceQuizzes", []), []);
  const source = localStorage.getItem("practiceSource") || "module";
  const lessonId =
    localStorage.getItem("practiceLessonId") ||
    `${courseId}-${scope.scopeId || "module"}`;
  const isMainQuiz = quizType === "main";
  const [, setAccessClock] = useState(0);
  useEffect(() => {
    if (!isMainQuiz) return;
    const timer = window.setInterval(
      () => setAccessClock((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [isMainQuiz]);
  const pageTitle =
    scope.scopeTitle || (isMainQuiz ? "Main Quiz" : "Practice Quiz");
  const pageKicker = isMainQuiz ? "Main Quiz" : "Practice Quiz";
  const backPath = `/student/enrolled-courses/${scope.courseId || courseId}`;
  const mainQuizLockReason =
    isMainQuiz && checkingQuizAccess
      ? "Checking Main Quiz access…"
      : quizAccessError ||
        getMainQuizLockReason(courseId, scope, moduleId, savedQuizAccess);

  useEffect(() => {
    if (!isMainQuiz) return;
    const controller = new AbortController();
    let active = true;
    Swal.fire({
      title: "Checking Main Quiz",
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    async function checkAccess() {
      try {
        const response = await fetch(
          `${API_BASE}/lessons/main-quiz/status/${encodeURIComponent(courseId)}/${encodeURIComponent(moduleId || scope.scopeId)}`,
          {
            credentials: "include",
            headers: lessonAuthHeaders(),
            signal: controller.signal,
          },
        );
        const data = await response.json();
        if (!response.ok || !data.success)
          throw new Error(data.message || "Could not verify Main Quiz access.");
        if (controller.signal.aborted) return;
        if (data.status.taken) {
          await Swal.fire({
            imageUrl: "/images/reminder.png?v=2", imageWidth: 300, imageAlt: "Quiz reminder", customClass: { popup: "student-reminder-popup", title: "student-reminder-title" },
            title: "Main Quiz already taken",
            text: "You have already taken this Main Quiz.",
            confirmButtonText: "OK",
          });
          navigate(backPath, { replace: true });
        } else {
          Swal.close();
          navigate(
            `/random-modes-tutorial/lesson/${encodeURIComponent(lessonId)}`,
            { replace: true },
          );
        }
      } catch (error) {
        if (!active) return;
        await Swal.fire({
          icon: "info",
          title: "Main Quiz unavailable",
          text:
            error.name === "AbortError"
              ? "The access check timed out. Please try again."
              : error.message,
          confirmButtonText: "OK",
        });
        navigate(backPath, { replace: true });
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void checkAccess();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [courseId, moduleId, isMainQuiz]);

  useEffect(() => {
    let active = true;

    async function loadModes() {
      try {
        setLoadingModes(true);
        const loadedModes = await fetchQuizModes();

        if (active) {
          setModes(loadedModes);
        }
      } finally {
        if (active) {
          setLoadingModes(false);
        }
      }
    }

    loadModes();

    const refreshModes = () => {
      fetchQuizModes().then((loadedModes) => {
        if (active) setModes(loadedModes);
      });
    };

    window.addEventListener("admin-modes-updated", refreshModes);
    window.addEventListener("storage", refreshModes);

    return () => {
      active = false;
      window.removeEventListener("admin-modes-updated", refreshModes);
      window.removeEventListener("storage", refreshModes);
    };
  }, []);

  const calculateTimedQuizSeconds = () => {
    const totalSeconds = quizzes.length * 90;
    return Math.min(Math.max(totalSeconds, 120), 1800);
  };

  const handleStartPractice = (mode) => {
    const modeKind = getModeKind(mode);
    const route = getModeRoute(mode, modeKind);
    const selectedMode = {
      ...mode,
      quizMode: modeKind,
      route,
    };

    if (modeKind === "timed") {
      localStorage.setItem(
        "timedQuizSeconds",
        String(calculateTimedQuizSeconds()),
      );
    } else {
      localStorage.removeItem("timedQuizSeconds");
    }

    localStorage.setItem("practiceMode", JSON.stringify(selectedMode));

    const nextRoute = buildPracticeRoute(route, source, lessonId);

    if (nextRoute) {
      navigate(nextRoute);
    }
  };

  if (!isMainQuiz) {
    return <Navigate to={backPath} replace />;
  }

  if (isMainQuiz) return null;

  return (
    <div className="student-module-quiz-page">
      <StudentSidebar />

      <div className="student-module-quiz-main-area">
        <StudentHeader
          searchPlaceholder="Search your course"
          showSearch={false}
          showJoinCourse={false}
        />

        <main className="student-module-quiz-content">
          <section className="student-module-quiz-shell">
            <button
              className="student-module-quiz-back"
              type="button"
              onClick={() => navigate(backPath)}
            >
              Back to Modules
            </button>

            <div className="student-module-quiz-header">
              <span>{pageKicker}</span>
              <h1>{pageTitle}</h1>
              <p>
                {scope.scopeDetail
                  ? `${scope.scopeDetail}. Choose how you want to answer this quiz.`
                  : "Choose how you want to answer this quiz."}
              </p>
            </div>

            <div className="student-module-quiz-modes">
              {mainQuizLockReason ? (
                <p className="student-module-quiz-empty">
                  {mainQuizLockReason}
                </p>
              ) : quizzes.length === 0 ? (
                <p className="student-module-quiz-empty">
                  No quiz questions were found for this page.
                </p>
              ) : loadingModes ? (
                <p className="student-module-quiz-empty">
                  Loading quiz modes...
                </p>
              ) : modes.length === 0 ? (
                <p className="student-module-quiz-empty">
                  No quiz modes available.
                </p>
              ) : (
                modes.map((mode) => (
                  <ModeCard
                    key={mode.id}
                    title={mode.title || mode.mode_name}
                    img={resolveModeImage(mode)}
                    desc={mode.description}
                    onClick={() => handleStartPractice(mode)}
                  />
                ))
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
