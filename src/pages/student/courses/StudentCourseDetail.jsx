import { studentVisibleModuleIndices } from "../../../utils/studentModuleVisibility.js";
import { mainQuizScheduleState } from "../../../utils/mainQuizSchedule.js";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";

import {
  getCourseContentModules,
  getCourseQuizItems,
} from "../../course/courseContent.js";
import { Avatar } from "../enrolled/EnrolledCourses.jsx";
import StudentSidebar from "../../../components/students/StudentSidebar.jsx";
import StudentHeader from "../../../components/students/StudentHeader.jsx";
import JoinCourseModal from "./JoinCourseModal.jsx";
import QuizModesModal from "../../../components/quizmodes/QuizModesModal.jsx";

import {
  enrollStudentInCourseAsync,
  findCourseByIdOrCodeAsync,
  findJoinableCourseByCodeAsync,
  getStudentModuleReadingProgress,
  getStudentReadingProgress,
  getStudentCourseModules,
  normalizeStudentCourse,
  STUDENT_READING_PROGRESS_EVENT,
} from "./studentCourseData";
import {
  clearStudentSession,
  getStudentAccountLabel,
  getStudentProfileHandle,
  useStudentProfile,
} from "../settings/studentProfileData.js";

import "./StudentCourseDetail.css";

import { API_BASE as API_BASE_URL } from "../../../config.js";
const MAIN_QUIZ_SETTINGS_STORAGE_KEY = "puffy-main-quiz-settings";
const COURSE_DRAFT_STORAGE_PREFIX = "puffy-course-builder-draft";
const PROFESSOR_COURSES_KEY = "professor-courses";

const notificationItems = [
  {
    id: 1,
    title: "Welcome to PuffyBrain!",
    message:
      "Your student account is ready. Start exploring your enrolled courses.",
    time: "Just now",
    unread: true,
    icon: "sparkle",
  },
  {
    id: 2,
    title: "New learning material",
    message:
      "A new module was added to ITEC 106 - Web Systems and Technologies 2.",
    time: "12 minutes ago",
    unread: true,
    icon: "course",
  },
  {
    id: 3,
    title: "Course announcement",
    message:
      "Your professor posted an announcement for Introduction to Computing.",
    time: "Yesterday",
    unread: false,
    icon: "announcement",
  },
];

function resolveProfileImage(imagePath) {
  if (!imagePath) return undefined;

  if (
    imagePath.startsWith("http://") ||
    imagePath.startsWith("https://") ||
    imagePath.startsWith("blob:") ||
    imagePath.startsWith("data:")
  ) {
    return imagePath;
  }

  const serverOrigin = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${serverOrigin}${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
}

function getStoredToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("puffy-token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken")
  );
}

function getProfessorDepartment(course) {
  return (
    course.professorDepartment ||
    course.professor_department ||
    "Department not set"
  );
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

function normalizeDateTimeLocal(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text)) {
    return text.slice(0, 16);
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function readMainQuizSettingsMap() {
  const mergedSettings = {};

  try {
    const saved = sessionStorage.getItem(MAIN_QUIZ_SETTINGS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      Object.assign(mergedSettings, parsed);
    }
  } catch {
    // Ignore malformed storage and keep checking other sources.
  }

  try {
    const saved = localStorage.getItem(MAIN_QUIZ_SETTINGS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      Object.assign(mergedSettings, parsed);
    }
  } catch {
    // Ignore malformed storage.
  }

  return mergedSettings;
}

function readStorageJson(key, fallback = null) {
  for (const storage of [sessionStorage, localStorage]) {
    try {
      const saved = storage.getItem(key);

      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Try the next storage area.
    }
  }

  return fallback;
}

function readStorageJsonValues(key) {
  const values = [];

  for (const storage of [sessionStorage, localStorage]) {
    try {
      const saved = storage.getItem(key);

      if (!saved) {
        continue;
      }

      const parsed = JSON.parse(saved);

      if (parsed !== null && parsed !== undefined) {
        values.push(parsed);
      }
    } catch {
      // Try the next storage area.
    }
  }

  return values;
}

function collectStorageJsonByPrefix(prefix) {
  const values = [];

  for (const storage of [sessionStorage, localStorage]) {
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
  }

  return values;
}

function readLocalStorageJson(key, fallback = null) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function getCourseSettingKeys(course = {}) {
  const keys = [
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
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return [...new Set(keys.flatMap((key) => [key, key.toLowerCase()]))];
}

function getModuleSettingKeys(module = {}, moduleIndex = 0) {
  const keys = [
    module?.id,
    module?.module_id,
    module?.moduleId,
    module?.lesson_id,
    module?.title,
    String(moduleIndex),
    String(moduleIndex + 1),
    `module-${moduleIndex + 1}`,
    `module ${moduleIndex + 1}`,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return [...new Set(keys.flatMap((key) => [key, key.toLowerCase()]))];
}

function readMainQuizSettingsOverride(course, module, moduleIndex) {
  const settingsMap = readMainQuizSettingsMap();
  const courseKeys = getCourseSettingKeys(course);
  const moduleKeys = getModuleSettingKeys(module, moduleIndex);

  for (const courseKey of courseKeys) {
    for (const moduleKey of moduleKeys) {
      const settings = settingsMap[`${courseKey}::${moduleKey}`];

      if (settings && typeof settings === "object") {
        return settings;
      }
    }
  }

  return null;
}

function getCourseContentModuleList(course = {}) {
  const modules = Array.isArray(course?.contentModules)
    ? course.contentModules
    : Array.isArray(course?.content_modules)
      ? course.content_modules
      : readStorageJsonValue(course?.content_modules);

  return Array.isArray(modules) ? modules : [];
}

function readStorageJsonValue(value) {
  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function keysOverlap(left = [], right = []) {
  const rightSet = new Set(right);
  return left.some((key) => rightSet.has(key));
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

function readStoredMainQuizSettingsOverride(course, module, moduleIndex) {
  const courseKeys = getCourseSettingKeys(course);
  const moduleKeys = getModuleSettingKeys(module, moduleIndex);
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
    const draft = readStorageJson(
      `${COURSE_DRAFT_STORAGE_PREFIX}:${courseKey}`,
      null,
    );

    addCourseCandidate(draft);
  });

  collectStorageJsonByPrefix(`${COURSE_DRAFT_STORAGE_PREFIX}:`).forEach(
    (draft) => {
      if (courseMatchesKeys(draft, courseKeys)) {
        addCourseCandidate(draft);
      }
    },
  );

  const savedCourseCollections = readStorageJsonValues(PROFESSOR_COURSES_KEY);

  savedCourseCollections.forEach((savedCourses) => {
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
    const candidateModules = getCourseContentModuleList(candidateCourse);
    const candidateModule = candidateModules.find((item, index) =>
      keysOverlap(getModuleSettingKeys(item, index), moduleKeys),
    );

    if (candidateModule) {
      const settings = coerceMainQuizSettings(candidateModule);

      if (hasExplicitMainQuizSettings(candidateModule)) {
        return settings;
      }
    }
  }

  return null;
}

function coerceMainQuizSettings(module = {}, override = null) {
  const settings = parseSettingsObject(
    override || module?.mainQuizSettings || module?.main_quiz_settings,
  );
  const enabled = normalizeBoolean(
    settings.enabled ??
      settings.isEnabled ??
      module?.mainQuizEnabled ??
      module?.main_quiz_enabled,
    true,
  );
  const unlockAt = normalizeDateTimeLocal(
    settings.unlockAt ||
      settings.unlock_at ||
      module?.mainQuizUnlockAt ||
      module?.main_quiz_unlock_at,
  );

  const lockAt = normalizeDateTimeLocal(
    settings.lockAt ||
      settings.lock_at ||
      module?.mainQuizLockAt ||
      module?.main_quiz_lock_at,
  );

  return {
    enabled,
    unlockAt,
    lockAt,
  };
}

function normalizeMainQuizSettings(
  module = {},
  course = null,
  moduleIndex = 0,
) {
  if (hasExplicitMainQuizSettings(module)) {
    return coerceMainQuizSettings(module);
  }
  const override = course
    ? readMainQuizSettingsOverride(course, module, moduleIndex) ||
      readStoredMainQuizSettingsOverride(course, module, moduleIndex)
    : null;

  return coerceMainQuizSettings(module, override);
}

function formatDateTimeLabel(value) {
  const normalized = normalizeDateTimeLocal(value);

  if (!normalized) {
    return "";
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getMainQuizAvailability(module = {}, course = null, moduleIndex = 0) {
  const settings = normalizeMainQuizSettings(module, course, moduleIndex);
  const scheduleState = mainQuizScheduleState(settings);

  if (scheduleState === "disabled") {
    return {
      available: false,
      reason: "Your professor has turned off the Main Quiz for this module.",
    };
  }

  if (scheduleState === "closed") {
    return {
      available: false,
      reason: `Main Quiz closed on ${formatDateTimeLabel(settings.lockAt)}.`,
    };
  }

  if (scheduleState === "scheduled") {
    return {
      available: false,
      reason: `Main Quiz opens on ${formatDateTimeLabel(settings.unlockAt)}.`,
    };
  }

  return {
    available: true,
    reason: "",
  };
}

function normalizeModule(module, index, course = null) {
  const lessonPages = Array.isArray(module?.lessonPages)
    ? module.lessonPages
    : Array.isArray(module?.lesson_pages)
      ? module.lesson_pages
      : [];

  const quizItems = Array.isArray(module?.quizItems)
    ? module.quizItems
    : Array.isArray(module?.quiz_items)
      ? module.quiz_items
      : [];

  return {
    ...module,
    id: module?.id || module?.module_id || `module-${index + 1}`,
    title: String(module?.title || "").trim() || `Module ${index + 1}`,
    description: String(module?.description || module?.summary || ""),
    learningObjectives: String(
      module?.learningObjectives || module?.learning_objectives || "",
    ),
    lessonPages,
    quizItems,
    mainQuizSettings: normalizeMainQuizSettings(module, course, index),
  };
}

function getNestedCourseModules(course) {
  const parsedModules = getCourseContentModules(course);

  if (parsedModules.length > 0) {
    return parsedModules.map((module, index) =>
      normalizeModule(module, index, course),
    );
  }

  return getStudentCourseModules(course).map((module, index) =>
    normalizeModule(module, index, course),
  );
}

export default function StudentCourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const studentProfile = useStudentProfile();

  const [rawCourse, setRawCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [practiceSession, setPracticeSession] = useState(null);
  const [joinCourseCode, setJoinCourseCode] = useState("");
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState(notificationItems);
  const [mainQuizSettingsVersion, setMainQuizSettingsVersion] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setMainQuizSettingsVersion((version) => version + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const [enrolledCoursesOpen, setEnrolledCoursesOpen] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("sidebarCollapsed") === "true";
  });

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

  const [, setProgressVersion] = useState(0);

  const loadEnrolledCourses = async () => {
    try {
      setCoursesLoading(true);

      const token = getStoredToken();

      if (!token) {
        setCourses([]);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/courses/enrolled`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not load enrolled courses.");
      }

      const loadedCourses = Array.isArray(data.courses)
        ? data.courses
        : Array.isArray(data.data)
          ? data.data
          : [];

      setCourses(loadedCourses);
    } catch (error) {
      console.error("Sidebar enrolled courses loading error:", error);

      setCourses([]);
    } finally {
      setCoursesLoading(false);
    }
  };

  useEffect(() => {
    loadEnrolledCourses();
  }, []);

  useEffect(() => {
    let active = true;

    let refreshing = false;
    async function loadCourse(background = false) {
      if (refreshing) return;
      refreshing = true;
      try {
        if (!background) setLoading(true);

        const selectedCourse = await findCourseByIdOrCodeAsync(courseId);

        if (active) {
          setRawCourse(selectedCourse);
        }
      } catch (error) {
        console.error("Could not load course:", error);

        if (active && !background) setRawCourse(null);
      } finally {
        refreshing = false;
        if (active && !background) setLoading(false);
      }
    }

    loadCourse();
    const refresh = () => { if (document.visibilityState === "visible") loadCourse(true); };
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [courseId]);

  useEffect(() => {
    const refreshProgress = () => {
      setProgressVersion((version) => version + 1);
    };
    const refreshMainQuizSettings = () => {
      setMainQuizSettingsVersion((version) => version + 1);
    };

    window.addEventListener(STUDENT_READING_PROGRESS_EVENT, refreshProgress);

    window.addEventListener("storage", refreshProgress);
    window.addEventListener("storage", refreshMainQuizSettings);
    window.addEventListener(
      "puffy-main-quiz-settings-updated",
      refreshMainQuizSettings,
    );

    return () => {
      window.removeEventListener(
        STUDENT_READING_PROGRESS_EVENT,
        refreshProgress,
      );

      window.removeEventListener("storage", refreshProgress);
      window.removeEventListener("storage", refreshMainQuizSettings);
      window.removeEventListener(
        "puffy-main-quiz-settings-updated",
        refreshMainQuizSettings,
      );
    };
  }, []);

  useEffect(() => {
    const closeOpenMenus = (event) => {
      if (!event.target.closest(".profile-menu-wrapper")) {
        setProfileMenuOpen(false);
      }

      if (!event.target.closest(".notification-menu-wrapper")) {
        setNotificationMenuOpen(false);
      }
    };

    const closeMenusWithEscape = (event) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
        setNotificationMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOpenMenus);
    document.addEventListener("keydown", closeMenusWithEscape);

    return () => {
      document.removeEventListener("mousedown", closeOpenMenus);
      document.removeEventListener("keydown", closeMenusWithEscape);
    };
  }, []);

  const course = rawCourse ? normalizeStudentCourse(rawCourse) : null;

  const modules = useMemo(
    () => (course ? getNestedCourseModules(course) : []),
    [course, mainQuizSettingsVersion],
  );

  const visibleModuleIndices = studentVisibleModuleIndices(modules);
  const visibleModuleCount = visibleModuleIndices.length;

  const courseRouteId = course
    ? String(course.id || course.course_id || course.code || "")
    : "";

  const allQuizItems = course ? getCourseQuizItems(course) : [];


  const moduleProgressValues = modules.map((_, index) =>
    getStudentModuleReadingProgress(courseRouteId, index, modules.length),
  );

  const getModuleProgress = (index) => moduleProgressValues[index] ?? 0;
  const courseProgress = visibleModuleCount
    ? Math.round(visibleModuleIndices.reduce((sum, index) => sum + getModuleProgress(index), 0) / visibleModuleCount)
    : 0;

  const isModuleLearnUnlocked = (index) => {
    const position = visibleModuleIndices.indexOf(index);
    if (position < 0) return false;
    return (
      position === 0 ||
      getModuleProgress(visibleModuleIndices[position - 1]) >= 100
    );
  };

  const isModulePracticeUnlocked = (index) =>
    isModuleLearnUnlocked(index) && getModuleProgress(index) >= 100;

  const areAllModulesCompleted =
    visibleModuleCount > 0 &&
    visibleModuleIndices.every((index) => getModuleProgress(index) >= 100);

  const createFallbackQuiz = (module, index) => ({
    id: `${module.id || courseRouteId}-practice-${index + 1}`,
    type: "multiple_choice",
    question: `What should you remember from ${module.title}?`,
    options: [
      module.description || course?.summary || "Review the module content.",
      "Skip the module content.",
      "Ignore the main idea.",
      "Only memorize the title.",
    ],
    correct_answer:
      module.description || course?.summary || "Review the module content.",
    answer:
      module.description || course?.summary || "Review the module content.",
    explanation:
      module.description ||
      course?.summary ||
      "Review this module before answering.",
    moduleId: module.id,
    moduleIndex: index,
    moduleTitle: module.title,
  });

  const getModuleAuthoredQuizItems = (module, index) => {
    if (Array.isArray(module.quizItems) && module.quizItems.length) {
      return module.quizItems;
    }

    const moduleId = String(module.id || "");
    const moduleTitle = String(module.title || "")
      .trim()
      .toLowerCase();

    const matchingItems = allQuizItems.filter((item) => {
      const itemModuleId = String(item.moduleId || item.module_id || "");

      const itemModuleIndex = Number(item.moduleIndex ?? item.module_index);

      const itemModuleTitle = String(
        item.moduleTitle ||
          item.module_title ||
          item.lessonTitle ||
          item.lesson_title ||
          "",
      )
        .trim()
        .toLowerCase();

      return (
        (moduleId && itemModuleId === moduleId) ||
        itemModuleIndex === index ||
        (moduleTitle && itemModuleTitle === moduleTitle)
      );
    });

    if (matchingItems.length) {
      return matchingItems;
    }

    if (modules.length === 1 && allQuizItems.length) {
      return allQuizItems;
    }

    return [];
  };

  const getModulePracticeItems = (module, index) => {
    const authoredItems = getModuleAuthoredQuizItems(module, index);

    if (authoredItems.length) {
      return authoredItems;
    }

    return [createFallbackQuiz(module, index)];
  };

  const startModuleLearning = async (module, index) => {
    if (!isModuleLearnUnlocked(index)) {
      await Swal.fire({
        icon: "info",
        title: "Module Locked",
        text: `Complete Module ${index} before opening Module ${index + 1}.`,
        confirmButtonText: "OK",
      });

      return;
    }

    const selectedModule = {
      courseId: courseRouteId,
      courseCode: course.code,
      moduleId: module.id,
      moduleIndex: index,
      moduleTitle: module.title,
      lessonPages: module.lessonPages,
    };

    localStorage.setItem(
      "selectedCourseModule",
      JSON.stringify(selectedModule),
    );

    navigate(`/introduction/${courseRouteId}?module=${index}`);
  };

  const prepareQuizSession = ({
    scopeId,
    scopeType,
    source,
    moduleIndex,
    moduleTitle,
    title,
    detail,
    quizzes,
  }) => {
    const practiceLessonId = `${courseRouteId}-${scopeId}`;

    localStorage.setItem("practiceSource", source);
    localStorage.setItem("practiceLessonId", practiceLessonId);
    localStorage.setItem("practiceQuizzes", JSON.stringify(quizzes));
    localStorage.removeItem("practiceDeckId");
    localStorage.removeItem("practiceCards");
    localStorage.setItem(
      "practiceScope",
      JSON.stringify({
        courseId: courseRouteId,
        courseCode: course.code,
        courseTitle: course.title,
        courseName: course.courseName || course.course_name || course.title,
        scopeId,
        scopeType,
        moduleIndex,
        moduleTitle,
        moduleNumber:
          Number.isInteger(moduleIndex) && moduleIndex >= 0
            ? moduleIndex + 1
            : null,
        moduleCount: modules.length,
        scopeTitle: title,
        scopeDetail: detail,
      }),
    );

    return practiceLessonId;
  };

  const openPracticeModes = (quizSession) => {
    const lessonId = prepareQuizSession(quizSession);
    setPracticeSession({
      source: quizSession.source,
      lessonId,
      quizzes: quizSession.quizzes,
    });
  };

  const openModulePractice = async (module, index) => {
    if (!isModuleLearnUnlocked(index)) {
      await Swal.fire({
        icon: "info",
        title: "Module Locked",
        text: `Complete Module ${index} before practicing Module ${index + 1}.`,
        confirmButtonText: "OK",
      });

      return;
    }

    if (!isModulePracticeUnlocked(index)) {
      await Swal.fire({
        icon: "info",
        title: "Finish Reading First",
        text: `Read all lesson pages in Module ${
          index + 1
        } before starting its practice quiz.`,
        confirmButtonText: "OK",
      });

      return;
    }

    const quizzes = getModulePracticeItems(module, index);

    openPracticeModes({
      scopeId: module.id,
      scopeType: "module",
      source: "module",
      moduleIndex: index,
      moduleTitle: module.title,
      title: module.title,
      detail: `${module.lessonPages.length} lesson page(s)`,
      quizzes,
    });
  };

  const openModuleMainQuiz = async (module, index) => {
    if (!isModuleLearnUnlocked(index)) {
      await Swal.fire({
        icon: "info",
        title: "Module Locked",
        text: `Complete Module ${index} before taking the Main Quiz for Module ${
          index + 1
        }.`,
        confirmButtonText: "OK",
      });

      return;
    }

    const mainQuizAvailability = getMainQuizAvailability(module, course, index);

    if (!mainQuizAvailability.available) {
      await Swal.fire({
        icon: "info",
        title: "Main Quiz Locked",
        text: mainQuizAvailability.reason,
        confirmButtonText: "OK",
      });

      return;
    }

    Swal.fire({
      title: "Checking Main Quiz",
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const response = await fetch(
        `${API_BASE_URL}/lessons/main-quiz/status/${encodeURIComponent(courseRouteId)}/${encodeURIComponent(module.id)}`,
        {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${getStoredToken()}`,
          },
          signal: AbortSignal.timeout(15000),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not check Main Quiz access.");
      }
      if (data.status.taken) {
        await Swal.fire({
          icon: "info",
          title: "Main Quiz already taken",
          text: "You have already taken this Main Quiz.",
          confirmButtonText: "OK",
        });
        return;
      }
      Swal.close();
    } catch (error) {
      await Swal.fire({
        icon: "info",
        title: "Main Quiz unavailable",
        text: error.message,
        confirmButtonText: "OK",
      });
      return;
    }

    const mainQuizLessonId = prepareQuizSession({
      scopeId: module.id,
      scopeType: "main_quiz",
      source: "module",
      moduleIndex: index,
      moduleTitle: module.title,
      title: `${module.title} Main Quiz`,
      detail: "Adaptive assessment",
      quizzes: [],
    });
    navigate(
      `/random-modes-tutorial/lesson/${encodeURIComponent(mainQuizLessonId)}`,
    );
  };

  const startCourseLearning = () => {
    const targetIndex =
      visibleModuleIndices.find((index) => getModuleProgress(index) < 100) ??
      visibleModuleIndices[0];

    const targetModule = modules[targetIndex];

    if (targetModule) {
      startModuleLearning(targetModule, targetIndex);
    }
  };

  const openCoursePractice = async () => {
    if (!areAllModulesCompleted) {
      await Swal.fire({
        icon: "info",
        title: "Complete All Modules",
        text: "Finish reading every module before practicing the complete course.",
        confirmButtonText: "OK",
      });

      return;
    }

    const quizzes = visibleModuleIndices.flatMap((index) =>
      getModulePracticeItems(modules[index], index),
    );

    openPracticeModes({
      scopeId: "all-modules",
      scopeType: "course",
      source: "course",
      moduleIndex: -1,
      title: `Everything in ${course.code}`,
      detail: `${visibleModuleCount} module(s)`,
      quizzes,
    });
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((currentValue) => {
      const nextValue = !currentValue;

      localStorage.setItem("sidebarCollapsed", String(nextValue));

      return nextValue;
    });
  };

  const closeJoinModal = () => {
    setJoinModalOpen(false);
    setJoinCourseCode("");
  };

  const joinByCourseCode = async () => {
    try {
      const trimmedCode = joinCourseCode.trim();

      if (!trimmedCode) {
        await Swal.fire({
          icon: "warning",
          title: "Enter Course Code",
          text: "Please enter the course code provided by your professor.",
          confirmButtonText: "OK",
          confirmButtonColor: "#7FA8D6",
        });

        return;
      }

      const course = await findJoinableCourseByCodeAsync(trimmedCode);

      if (!course) {
        await Swal.fire({
          icon: "error",
          title: "Course Not Found",
          text: "Course code not found. Please check the code from your professor.",
          confirmButtonText: "OK",
          confirmButtonColor: "#7FA8D6",
        });

        return;
      }

      await enrollStudentInCourseAsync(course);

      closeJoinModal();

      await loadEnrolledCourses();

      await Swal.fire({
        icon: "success",
        title: "Course Joined!",
        text: `You have successfully joined ${
          course.title || course.course_name || course.name || "the course"
        }.`,
        confirmButtonText: "Continue",
        confirmButtonColor: "#7FA8D6",
      });

      const courseId =
        course.id ||
        course.courseId ||
        course.course_id ||
        course.code ||
        course.courseCode ||
        course.course_code;

      navigate(`/student/enrolled-courses/${courseId}`);
    } catch (error) {
      console.error("Join course error:", error);

      await Swal.fire({
        icon: "error",
        title: "Unable to Join Course",
        text: error?.message || "Unable to join the course.",
        confirmButtonText: "OK",
        confirmButtonColor: "#7FA8D6",
      });
    }
  };

  const unreadNotificationCount = notifications.filter(
    (notification) => notification.unread,
  ).length;

  const markAllNotificationsAsRead = () => {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({
        ...notification,
        unread: false,
      })),
    );
  };

  const openNotification = (notificationId) => {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === notificationId
          ? { ...notification, unread: false }
          : notification,
      ),
    );
  };

  const profileHandle = getStudentProfileHandle(studentProfile);
  const accountLabel = getStudentAccountLabel(studentProfile);

  const handleLogout = () => {
    setProfileMenuOpen(false);
    setNotificationMenuOpen(false);
    clearStudentSession();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="student-course-detail-page">
        <StudentSidebar />
        <div className="student-course-detail-main-area">
          <StudentHeader
            searchPlaceholder="Search your course"
            onJoinCourse={() => setJoinModalOpen(true)}
          />
          <main className="student-course-detail-content">
            <section className="student-course-shell">
              <div className="student-empty-state">Loading course...</div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="student-course-detail-page">
        <StudentSidebar />
        <div className="student-course-detail-main-area">
          <StudentHeader
            searchPlaceholder="Search your course"
            onJoinCourse={() => setJoinModalOpen(true)}
          />
          <main className="student-course-detail-content">
            <section className="student-course-shell">
              <div className="student-empty-state">Course not found.</div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="student-course-detail-page">
      <StudentSidebar />
      <div className="student-course-detail-main-area">
        <StudentHeader
          searchPlaceholder="Search your course"
          onJoinCourse={() => setJoinModalOpen(true)}
        />
        <main className="student-course-detail-content">
          <section className="student-course-shell">
            <div className="student-course-hero">
              <div className="student-course-meta-row">
                <span>{course.code}</span>

                <span>
                  {course.visibility === "private"
                    ? "Private course"
                    : "Public course"}
                </span>
              </div>

              <div className="student-course-copy">
                <h1>{course.title}</h1>

                <p>
                  {course.summary ||
                    "Continue learning and practicing this course."}
                </p>

                <div
                  className="student-course-progress"
                  aria-label={`Course reading progress ${courseProgress}%`}
                >
                  <span className="student-course-progress-track">
                    <i style={{ width: `${courseProgress}%` }} />
                  </span>

                  <div>
                    <span>Reading progress</span>
                    <strong>{courseProgress}%</strong>
                  </div>
                </div>

                <div className="student-course-bottom-row">
                  <div className="student-course-creator">
                    <Avatar
                      src={resolveProfileImage(
                        course.professorProfileImage ||
                          course.professor_profile_image,
                      )}
                      alt={`${
                        course.instructor || course.professorName || "Professor"
                      }'s profile`}
                    />

                    <div className="enrolled-course-meta">
                      <span>
                        {course.instructor ||
                          course.professorName ||
                          "Professor"}
                      </span>

                      <small>{getProfessorDepartment(course)}</small>
                    </div>
                  </div>

                  <div className="student-course-actions">
                    <button
                      type="button"
                      className="student-start-button"
                      onClick={startCourseLearning}
                      disabled={visibleModuleCount === 0}
                    >
                      Start Learning
                    </button>

                    <button
                      type="button"
                      className="student-practice-button"
                      onClick={openCoursePractice}
                      disabled={!areAllModulesCompleted}
                      title={
                        areAllModulesCompleted
                          ? "Practice the complete course"
                          : "Complete all modules before practicing the complete course."
                      }
                    >
                      Practice All
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <section
              className="student-course-modules"
              aria-labelledby="course-modules-title"
            >
              <div className="student-course-section-title">
                <div>
                  <h2 id="course-modules-title">Modules</h2>
                  <p className="student-module-section-description">
                    Complete each module to unlock the next one.
                  </p>
                </div>

                <span>{visibleModuleCount} module(s)</span>
              </div>

              {visibleModuleCount === 0 ? (
                <div className="student-empty-state">
                  No modules have been added to this course yet.
                </div>
              ) : (
                <div className="student-module-list">
                  {modules.map((module, index) => {
                    if (!visibleModuleIndices.includes(index)) return null;
                    const moduleProgress = getModuleProgress(index);
                    const learnUnlocked = isModuleLearnUnlocked(index);
                    const practiceUnlocked = isModulePracticeUnlocked(index);
                    const mainQuizAvailability = getMainQuizAvailability(
                      module,
                      course,
                      index,
                    );
                    const mainQuizDisabled =
                      !learnUnlocked || !mainQuizAvailability.available;
                    const mainQuizTitle = !learnUnlocked
                      ? "Complete the previous module first."
                      : !mainQuizAvailability.available
                        ? mainQuizAvailability.reason
                        : `Take the Main Quiz for ${module.title}`;

                    const moduleState = !learnUnlocked
                      ? "locked"
                      : moduleProgress >= 100
                        ? "complete"
                        : moduleProgress > 0
                          ? "current"
                          : "available";

                    return (
                      <article
                        className={`student-module-row ${moduleState}`}
                        key={module.id}
                      >
                        <span className="student-module-number">
                          {learnUnlocked ? index + 1 : "🔒"}
                        </span>

                        <div className="student-module-main">
                          <div className="student-module-title-row">
                            <span className="student-module-eyebrow">
                              Module {index + 1}
                            </span>
                          </div>

                          <h3>{module.title}</h3>

                          {!learnUnlocked && (
                            <small className="student-module-lock-message">
                              Complete Module{" "}
                              {visibleModuleIndices[
                                visibleModuleIndices.indexOf(index) - 1
                              ] + 1}{" "}
                              to unlock this module.
                            </small>
                          )}

                          <div
                            className="student-module-progress"
                            aria-label={`${module.title} reading progress ${moduleProgress}%`}
                          >
                            <span>
                              <i style={{ width: `${moduleProgress}%` }} />
                            </span>

                            <strong>{moduleProgress}%</strong>
                          </div>
                        </div>

                        <div className="student-module-action-panel">
                          <span
                            className={`student-module-status ${moduleState}`}
                          >
                            {!learnUnlocked
                              ? "Locked"
                              : moduleProgress >= 100
                                ? "Completed"
                                : moduleProgress > 0
                                  ? "In progress"
                                  : "Available"}
                          </span>
                          <div className="student-module-actions">
                            <button
                              type="button"
                              className="student-module-learn-button"
                              onClick={() => startModuleLearning(module, index)}
                              disabled={!learnUnlocked}
                            >
                              {moduleProgress > 0 ? "Continue" : "Learn"}
                            </button>

                            <button
                              type="button"
                              className="student-module-practice-button"
                              onClick={() => openModulePractice(module, index)}
                              disabled={!practiceUnlocked}
                              title={
                                practiceUnlocked
                                  ? `Practice ${module.title}`
                                  : "Finish reading this module first."
                              }
                            >
                              Practice
                            </button>

                            <button
                              type="button"
                              className={`student-module-main-quiz-button ${
                                mainQuizDisabled ? "is-disabled" : ""
                              }`}
                              onClick={(event) => {
                                if (mainQuizDisabled) {
                                  event.preventDefault();
                                  return;
                                }

                                openModuleMainQuiz(module, index);
                              }}
                              disabled={mainQuizDisabled}
                              aria-disabled={mainQuizDisabled}
                              title={mainQuizTitle}
                            >
                              Main Quiz
                            </button>
                          </div>

                          {mainQuizDisabled && (
                            <small className="student-module-main-quiz-lock-message">
                              {mainQuizTitle}
                            </small>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </section>
        </main>
      </div>
      {practiceSession && (
        <QuizModesModal
          source={practiceSession.source}
          lessonId={practiceSession.lessonId}
          quizzes={practiceSession.quizzes}
          onClose={() => setPracticeSession(null)}
        />
      )}
      <JoinCourseModal
        open={joinModalOpen}
        courseCode={joinCourseCode}
        onCourseCodeChange={setJoinCourseCode}
        onCancel={closeJoinModal}
        onJoin={joinByCourseCode}
      />
    </div>
  );
}
