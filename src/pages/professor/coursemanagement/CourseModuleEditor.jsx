import { removeLessonPracticeActivities } from "../../../services/lessonPracticeContent.js";
import { generateModuleRecap } from "../../../services/moduleRecapGeneration.js";
import { LessonContentEditor } from "../../../components/lesson/LessonContent.jsx";
import { createPortal } from "react-dom";
import ManagementBackBar from "../../../components/ManagementBackBar.jsx";
import { ensureGenerationCourse } from "../../../services/generationCourseDraft.js";
import QuizSourceEvidence from "../../../components/quizmodes/QuizSourceEvidence.jsx";
import { lessonAuthHeaders } from "../../../services/lessonAuth.js";
import {
  requestQuizSettings,
  quizSourceFields,
  quizGenerationFields,
} from "../../../services/quizGenerationUi.js";
import { notifyLessonGenerated } from "../../../services/lessonNotifications.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import Swal from "sweetalert2";

import { API_BASE } from "../../../config.js";
import { fetchCourse, saveCourse } from "../../../services/courseApi.js";
import { uploadLessonSource } from "../../../services/lessonRagApi.js";
import LessonFilePicker from "../../../components/lesson/LessonFilePicker.jsx";
import LessonSourceEvidence from "../../../components/lesson/LessonSourceEvidence.jsx";
import LessonSourceManager from "../../../components/lesson/LessonSourceManager.jsx";
import LoadingState from "../../../components/LoadingState.jsx";

import styles from "./Addmodule.module.css";
import { tutorialCourseDraft } from "../tutorial/professorTutorialExamples.js";

const TITLE_LIMIT = 100;
const LONG_LIMIT = 750;
const LESSON_LIMIT = 6000;
const QUIZ_LIMIT = 500;
const QUIZ_TAB_PAGE_SIZE = 10;
const COURSE_DRAFT_STORAGE_PREFIX = "puffy-course-builder-draft";
const MAIN_QUIZ_SETTINGS_STORAGE_KEY = "puffy-main-quiz-settings";

function createId(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function limit(value, max) {
  return String(value || "").slice(0, max);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(new Error("Could not read the selected media file."));
    reader.readAsDataURL(file);
  });
}

function createEmptyLessonPage() {
  return {
    id: createId("page"),
    title: "",
    content: "",
    media: null,
  };
}

function createEmptyQuizItem() {
  return {
    id: createId("quiz"),
    type: "multiple_choice",
    question: "",
    options: ["", "", "", ""],
    correct_answer: "",
    accepted_answers: [],
    explanation: "",
  };
}

function normalizeAcceptedAnswers(value) {
  const candidates = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/)
      : [];
  const unique = new Map();
  candidates.forEach((candidate) => {
    if (typeof candidate !== "string") return;
    const answer = candidate.trim();
    const key = answer.normalize("NFKC").replace(/\s+/g, " ").toLowerCase();
    if (key && !unique.has(key)) unique.set(key, answer);
  });
  return [...unique.values()];
}

function parseList(value) {
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

function readList(...values) {
  for (const value of values) {
    const parsed = parseList(value);

    if (parsed.length) {
      return parsed;
    }
  }

  return [];
}

function normalizeLessonPage(page) {
  return {
    ...page,
    id: page?.id || createId("page"),
    title: String(page?.title || ""),
    content: String(page?.content || page?.description || ""),
    media: page?.media || null,
    mediaUrl: page?.mediaUrl || page?.media_url || "",
    mediaName: page?.mediaName || page?.media_name || "",
    mediaType: page?.mediaType || page?.media_type || "",
  };
}

function getLessonPageMedia(page) {
  const media = page?.media || {};
  const url = media.url || page?.mediaUrl || page?.media_url || "";

  if (!url) {
    return null;
  }

  return {
    url,
    name: media.name || page?.mediaName || page?.media_name || "Uploaded media",
    type: media.type || page?.mediaType || page?.media_type || "",
  };
}

function normalizeQuizItem(item) {
  const type = ["multiple_choice", "identification", "true_false"].includes(
    item?.type,
  )
    ? item.type
    : "multiple_choice";
  let options = Array.isArray(item?.options)
    ? item.options.map((option) => String(option || ""))
    : [];

  if (type === "identification") {
    options = [];
  } else if (type === "true_false") {
    options = ["True", "False"];
  } else {
    options = options.slice(0, 4);

    while (options.length < 4) {
      options.push("");
    }
  }

  return {
    ...item,
    id: item?.id || createId("quiz"),
    type,
    question: String(item?.question || ""),
    topic: String(item?.topic || ""),
    options,
    correct_answer: String(item?.correct_answer || item?.answer || ""),
    accepted_answers:
      type === "identification"
        ? normalizeAcceptedAnswers(
            item?.accepted_answers ??
              item?.acceptedAnswers ??
              item?.acceptable_answers ??
              item?.answer_aliases ??
              item?.alternatives,
          )
        : [],
    explanation: String(item?.explanation || ""),
  };
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

function normalizeMainQuizSettings(module = {}) {
  const settings = parseSettingsObject(
    module?.mainQuizSettings || module?.main_quiz_settings,
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
    manualQuestions: module.mainQuizItems || settings.manualQuestions || [],
  };
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

function isMainQuizRoute(value = "") {
  return ["main", "main-quiz"].includes(String(value).toLowerCase());
}

function normalizeContentModule(module, index = 0) {
  const mainQuizSettings = normalizeMainQuizSettings(module);

  return {
    ...(module?.studentPublished !== undefined
      ? { studentPublished: module.studentPublished }
      : {}),
    id:
      module?.id ||
      module?.lesson_id ||
      module?.module_id ||
      createId("module"),
    title: String(module?.title || "").trim() || `Module ${index + 1}`,
    description: String(module?.description || module?.summary || ""),
    topics: Array.isArray(module?.topics)
      ? [...new Set(module.topics.map((topic) => String(topic || "").trim()).filter(Boolean))]
      : [],
    learningObjectives: String(
      module?.learningObjectives || module?.learning_objectives || "",
    ),
    lessonPages: readList(
      module?.lessonPages,
      module?.lesson_pages,
      module?.lessonContent,
      module?.lesson_content,
      module?.lesson_contents,
    ).map(normalizeLessonPage),
    quizItems: readList(
      module?.quizItems,
      module?.quiz_items,
      module?.quizModule,
      module?.quiz_contents,
    ).map(normalizeQuizItem),
    mainQuizItems: (mainQuizSettings.manualQuestions || []).map(
      normalizeQuizItem,
    ),
    mainQuizSettings,
    mainQuizEnabled: mainQuizSettings.enabled,
    main_quiz_enabled: mainQuizSettings.enabled,
    mainQuizUnlockAt: mainQuizSettings.unlockAt,
    main_quiz_unlock_at: mainQuizSettings.unlockAt,
    mainQuizLockAt: mainQuizSettings.lockAt,
    main_quiz_lock_at: mainQuizSettings.lockAt,
  };
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
      // Ignore malformed storage and keep the editor usable.
    }
  });

  return mergedSettings;
}

function writeMainQuizSettingsMap(settingsMap) {
  [localStorage, sessionStorage].forEach((storage) => {
    try {
      storage.setItem(
        MAIN_QUIZ_SETTINGS_STORAGE_KEY,
        JSON.stringify(settingsMap),
      );
    } catch {
      // Storage can fail in private windows. The in-memory draft still updates.
    }
  });
}

function getLessonPageNumbers(totalPages, currentPage) {
  const pageGroupSize = 10;
  const start = Math.floor((currentPage - 1) / pageGroupSize) * pageGroupSize;
  return Array.from(
    { length: Math.min(pageGroupSize, totalPages - start) },
    (_, index) => start + index + 1,
  );
}

function getCourseSettingKeys(course = {}, routeId = "") {
  const keys = [
    routeId,
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
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return [...new Set(keys.flatMap((key) => [key, key.toLowerCase()]))];
}

function writeMainQuizSettingsOverride(
  course,
  module,
  settings,
  routeId,
  moduleIndex,
) {
  const settingsMap = readMainQuizSettingsMap();
  const courseKeys = getCourseSettingKeys(course, routeId);
  const moduleKeys = getModuleSettingKeys(module, moduleIndex);

  courseKeys.forEach((courseKey) => {
    moduleKeys.forEach((moduleKey) => {
      settingsMap[`${courseKey}::${moduleKey}`] = settings;
    });
  });

  writeMainQuizSettingsMap(settingsMap);
  window.dispatchEvent(new CustomEvent("puffy-main-quiz-settings-updated"));
}

function normalizeCourse(course) {
  const nestedModules = Array.isArray(course?.contentModules)
    ? course.contentModules
    : Array.isArray(course?.content_modules)
      ? course.content_modules
      : Array.isArray(course?.learningModules)
        ? course.learningModules
        : Array.isArray(course?.learning_modules)
          ? course.learning_modules
          : [];

  return {
    ...course,
    title: String(course?.title || ""),
    code: String(
      course?.code || course?.courseCode || course?.course_code || "",
    ),
    summary: String(course?.summary || ""),
    subject: String(course?.subject || ""),
    status: course?.status === "published" ? "published" : "draft",
    visibility: course?.visibility === "public" ? "public" : "private",
    contentModules: nestedModules.map(normalizeContentModule),
  };
}

function getCourseDraftStorageKey(courseId) {
  return `${COURSE_DRAFT_STORAGE_PREFIX}:${courseId || "new"}`;
}

function readCourseBuilderDraft(courseId) {
  try {
    return JSON.parse(
      sessionStorage.getItem(getCourseDraftStorageKey(courseId)) || "null",
    );
  } catch {
    return null;
  }
}

function writeCourseBuilderDraft(courseId, draft) {
  try {
    sessionStorage.setItem(
      getCourseDraftStorageKey(courseId),
      JSON.stringify(draft),
    );
  } catch {
    // Session storage can fail in private windows. Navigation state still carries the draft.
  }
}

export default function CourseModuleEditor({ quizManagement = false }) {
  const { id, moduleId, assessmentType } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { tutorialStep } = useOutletContext() ?? {};
  const tutorialEditor =
    [
      "generate-module",
      "add-page",
      "quiz-settings",
      "quiz-add-question",
      "quiz-auto-generate-total",
      "quiz-auto-generate-distribution",
      "quiz-auto-generate-passing-grade",
    ].includes(tutorialStep?.id) ||
    (id === "tutorial-course" && moduleId === "tutorial-module");
  const isMainAssessment = isMainQuizRoute(assessmentType);

  const generationCourseRef = useRef(null);
  const mainQuizSettingsDialog = useRef(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  useEffect(() => {
    if (!generatorOpen) return;
    const root = document.getElementById("root");
    const wasInert = root?.inert;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    if (root) root.inert = true;
    document.body.style.overflow = "hidden";
    return () => {
      if (root) root.inert = wasInert;
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [generatorOpen]);

  const [loading, setLoading] = useState(true);
  const [courseDraft, setCourseDraft] = useState(null);
  const [moduleDraft, setModuleDraft] = useState(null);
  const [uploadedFile, setUploadedFile] = useState([]);
  const [generationProgress, setGenerationProgress] = useState("");
  const [processingFile, setProcessingFile] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [mainQuizConfig, setMainQuizConfig] = useState(null);
  const [generatedMainQuizzes, setGeneratedMainQuizzes] = useState([]);
  const [selectedMainQuiz, setSelectedMainQuiz] = useState(-1);
  const [mainConfigError, setMainConfigError] = useState("");
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [activeQuizIndex, setActiveQuizIndex] = useState(0);
  const [selectedQuestionIndexes, setSelectedQuestionIndexes] = useState([]);
  const [selectedPageIndexes, setSelectedPageIndexes] = useState([]);

  useEffect(() => {
    setSelectedPageIndexes([]);
  }, [id, moduleId]);

  const builderPath = id
    ? `/professor/courses/edit/${id}`
    : "/professor/courses/new";
  const isQuizWorkspace = quizManagement || isMainAssessment;
  const quizModulePath = id
    ? `/professor/quizzes/${encodeURIComponent(id)}/modules/${encodeURIComponent(moduleId)}`
    : `${builderPath}/modules/${moduleId}`;

  useEffect(() => {
    setActiveQuizIndex(0);
  }, [isMainAssessment]);

  useEffect(() => {
    let active = true;

    async function loadDraft() {
      try {
        setLoading(true);

        let draft = tutorialEditor
          ? tutorialCourseDraft
          : location.state?.courseDraft || readCourseBuilderDraft(id);

        if (!draft && id) {
          const course = await fetchCourse(id);
          draft = normalizeCourse(course);
        }

        if (!draft) {
          throw new Error("Open a course first before editing its module.");
        }

        const normalizedCourse = normalizeCourse(draft);
        const selectedModule = normalizedCourse.contentModules.find(
          (module) => String(module.id) === String(moduleId),
        );

        if (!selectedModule) {
          throw new Error("This module could not be found.");
        }

        if (!active) {
          return;
        }

        setCourseDraft(normalizedCourse);
        setModuleDraft(selectedModule);
        if (!tutorialEditor) writeCourseBuilderDraft(id, normalizedCourse);
      } catch (error) {
        if (!active) {
          return;
        }

        await Swal.fire({
          icon: "error",
          title: "Unable to Open Module",
          text: error.message || "Could not open this module.",
          confirmButtonText: "OK",
        });

        navigate(builderPath, { replace: true });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDraft();

    return () => {
      active = false;
    };
  }, [builderPath, id, location.state, moduleId, navigate, tutorialEditor]);

  useEffect(() => {
    if (tutorialEditor) return;
    const savedId = courseDraft?.id || id;
    setMainQuizConfig(null);
    setMainConfigError("");
    setGeneratedMainQuizzes([]);
    setSelectedMainQuiz(-1);
    if (!Number.isSafeInteger(Number(savedId)) || Number(savedId) < 1) return;
    const controller = new AbortController();
    fetch(
      `${API_BASE}/lessons/main-quiz/config/${encodeURIComponent(savedId)}/${encodeURIComponent(moduleId)}`,
      {
        credentials: "include",
        headers: lessonAuthHeaders(),
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        const data = await response.json().catch(() => {
          throw Error(
            "Main Quiz service returned an empty or invalid response. Check that the backend is running, then reload.",
          );
        });
        if (!response.ok || !data.success)
          throw Error(
            data.message || "Could not load Main Quiz configuration.",
          );
        setMainQuizConfig(data.config);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setMainConfigError(error.message);
      });
    fetch(
      `${API_BASE}/lessons/main-quiz/generated/${encodeURIComponent(savedId)}/${encodeURIComponent(moduleId)}`,
      {
        credentials: "include",
        headers: lessonAuthHeaders(),
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        const data = await response.json().catch(() => {
          throw Error(
            "Main Quiz service returned an empty or invalid response. Check that the backend is running, then reload.",
          );
        });
        if (!response.ok || !data.success)
          throw Error(data.message || "Could not load generated Main Quizzes.");
        setGeneratedMainQuizzes(data.quizzes || []);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setMainConfigError(error.message);
      });
    return () => controller.abort();
  }, [courseDraft?.id, id, moduleId, tutorialEditor]);

  useEffect(() => {
    if (
      !isMainAssessment ||
      loading ||
      !moduleDraft ||
      tutorialStep?.id !== "quiz-settings"
    ) {
      return;
    }
    const dialog = mainQuizSettingsDialog.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [isMainAssessment, loading, moduleDraft?.id, tutorialStep?.id]);

  useEffect(() => {
    if (
      !isMainAssessment ||
      loading ||
      !moduleDraft ||
      ![
        "quiz-auto-generate-total",
        "quiz-auto-generate-distribution",
        "quiz-auto-generate-passing-grade",
      ].includes(tutorialStep?.id)
    ) {
      return;
    }
    void requestQuizSettings({ assessment: "main", tutorialPreview: true });
    return () => Swal.close();
  }, [isMainAssessment, loading, moduleDraft?.id, tutorialStep?.id]);

  const activePage = moduleDraft?.lessonPages?.[activePageIndex] || null;
  const baselinePreview =
    isMainAssessment &&
    selectedMainQuiz < 0 &&
    !moduleDraft?.mainQuizItems?.length &&
    Array.isArray(mainQuizConfig?.baselineQuestions);
  const assessmentItems = isMainAssessment
    ? selectedMainQuiz < 0
      ? baselinePreview
        ? mainQuizConfig.baselineQuestions.map(normalizeQuizItem)
        : moduleDraft?.mainQuizItems || []
      : generatedMainQuizzes[selectedMainQuiz]?.questions || []
    : [];
  const activeQuiz = assessmentItems[activeQuizIndex] || null;
  const viewingGeneratedMain = isMainAssessment && selectedMainQuiz >= 0;
  const activePageMedia = getLessonPageMedia(activePage);

  const lessonCount = moduleDraft?.lessonPages?.length || 0;
  const quizCount = assessmentItems.length;
  const printableQuestionGroups = [
    { type: "multiple_choice", title: "Test 1: Multiple Choice" },
    { type: "identification", title: "Test 2: Identification" },
    { type: "true_false", title: "Test 3: True or False" },
  ]
    .map((group) => ({
      ...group,
      questions: assessmentItems.filter((item) => item.type === group.type),
    }))
    .filter((group) => group.questions.length > 0);
  let printQuestionNumber = 0;
  const numberedPrintableQuestionGroups = printableQuestionGroups.map(
    (group) => ({
      ...group,
      questions: group.questions.map((question) => ({
        question,
        number: ++printQuestionNumber,
      })),
    }),
  );
  useEffect(() => {
    setSelectedQuestionIndexes([]);
  }, [
    moduleId,
    isMainAssessment,
    selectedMainQuiz,
    quizCount,
    baselinePreview,
  ]);
  const lessonPageNumbers = getLessonPageNumbers(
    lessonCount,
    activePageIndex + 1,
  );
  const activeQuizPageIndex = Math.floor(activeQuizIndex / QUIZ_TAB_PAGE_SIZE);
  const activeQuizPageStart = activeQuizPageIndex * QUIZ_TAB_PAGE_SIZE;
  const activeQuizPageEnd = Math.min(
    activeQuizPageStart + QUIZ_TAB_PAGE_SIZE,
    quizCount,
  );
  const visibleQuizItems = assessmentItems.slice(
    activeQuizPageStart,
    activeQuizPageEnd,
  );
  const mainQuizSettings = normalizeMainQuizSettings(moduleDraft || {});
  const mainQuizUnlockLabel = formatDateTimeLabel(mainQuizSettings.unlockAt);
  const tutorialSettingsPreview = tutorialStep?.id === "quiz-settings";

  const canMovePrevious = useMemo(() => activePageIndex > 0, [activePageIndex]);

  const canMoveNext = useMemo(
    () => activePageIndex < lessonCount - 1,
    [activePageIndex, lessonCount],
  );

  const canShowPreviousQuizPage = activeQuizPageStart > 0;
  const canShowNextQuizPage = activeQuizPageEnd < quizCount;

  const goToPreviousQuizPage = () => {
    setActiveQuizIndex(Math.max(0, activeQuizPageStart - QUIZ_TAB_PAGE_SIZE));
  };

  const goToNextQuizPage = () => {
    setActiveQuizIndex(Math.min(quizCount - 1, activeQuizPageEnd));
  };

  const updateModuleField = (field, value) => {
    setModuleDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const showMainQuizSettingsNotice = async (options) => {
    const dialog = mainQuizSettingsDialog.current;
    const wasOpen = Boolean(dialog?.open);
    const focusedControl = document.activeElement;
    if (wasOpen) dialog.close();
    try {
      return await Swal.fire(options);
    } finally {
      if (wasOpen && dialog.isConnected && !dialog.open) {
        dialog.showModal();
        if (focusedControl?.isConnected && dialog.contains(focusedControl)) {
          focusedControl.focus();
        }
      }
    }
  };

  const updateMainQuizSettings = async (field, value) => {
    if (!moduleDraft || !courseDraft) {
      return;
    }

    const nextSettings = {
      ...normalizeMainQuizSettings(moduleDraft),
      [field]: value,
      ...(field === "unlockAt" && value ? { enabled: true } : {}),
    };
    if (
      nextSettings.unlockAt &&
      nextSettings.lockAt &&
      new Date(nextSettings.lockAt).getTime() <=
        new Date(nextSettings.unlockAt).getTime()
    ) {
      await showMainQuizSettingsNotice({
        icon: "error",
        title: "Invalid quiz dates",
        text: "The lock date must be after the unlock date.",
      });
      return;
    }
    const nextModule = {
      ...moduleDraft,
      mainQuizSettings: nextSettings,
      main_quiz_settings: nextSettings,
      mainQuizEnabled: nextSettings.enabled,
      main_quiz_enabled: nextSettings.enabled,
      mainQuizUnlockAt: nextSettings.unlockAt,
      main_quiz_unlock_at: nextSettings.unlockAt,
      mainQuizLockAt: nextSettings.lockAt,
      main_quiz_lock_at: nextSettings.lockAt,
    };
    const moduleIndex = courseDraft.contentModules.findIndex(
      (module) => String(module.id) === String(moduleId),
    );
    const nextCourse = {
      ...courseDraft,
      contentModules: courseDraft.contentModules.map((module) =>
        String(module.id) === String(moduleId) ? nextModule : module,
      ),
    };

    setModuleDraft(nextModule);
    setCourseDraft(nextCourse);
    writeCourseBuilderDraft(id, nextCourse);
    writeMainQuizSettingsOverride(
      nextCourse,
      nextModule,
      nextSettings,
      id,
      moduleIndex >= 0 ? moduleIndex : 0,
    );
    if (id) {
      try {
        await saveCourse(nextCourse, { fallback: false });
      } catch (error) {
        await showMainQuizSettingsNotice({
          icon: "error",
          title: "Quiz settings not saved",
          text:
            error.message || "Could not save quiz access. Please try again.",
        });
      }
    }
  };

  const updateLessonPage = (pageIndex, field, value) => {
    setModuleDraft((current) => ({
      ...current,
      lessonPages: current.lessonPages.map((page, index) =>
        index === pageIndex
          ? {
              ...page,
              [field]: value,
              ...(field === "content" || field === "title"
                ? {
                    grounding: {
                      ...page.grounding,
                      model_review_passed: false,
                      human_review_required: true,
                    },
                  }
                : {}),
            }
          : page,
      ),
    }));
  };

  const handlePageMediaSelected = async (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      await Swal.fire({
        icon: "warning",
        title: "Unsupported File",
        text: "Please choose an image or video file.",
        confirmButtonText: "OK",
      });

      return;
    }

    let url = "";

    try {
      url = await readFileAsDataUrl(file);
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "Upload Failed",
        text: error.message || "Could not read the selected media file.",
        confirmButtonText: "OK",
      });

      return;
    }

    setModuleDraft((current) => ({
      ...current,
      lessonPages: current.lessonPages.map((page, index) =>
        index === activePageIndex
          ? {
              ...page,
              media: {
                name: file.name,
                type: file.type,
                url,
              },
              mediaUrl: url,
              mediaName: file.name,
              mediaType: file.type,
            }
          : page,
      ),
    }));
  };

  const addLessonPage = () => {
    setModuleDraft((current) => {
      const lessonPages = [...current.lessonPages, createEmptyLessonPage()];
      setActivePageIndex(lessonPages.length - 1);

      return {
        ...current,
        lessonPages,
      };
    });
  };

  const removeSelectedLessonPages = async () => {
    if (!selectedPageIndexes.length) {
      return;
    }

    const result = await Swal.fire({
      icon: "warning",
      title: "Remove Selected Pages?",
      text: `${selectedPageIndexes.length} lesson page(s) will be removed from the module.`,
      showCancelButton: true,
      confirmButtonText: "Remove Selected",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#d93025",
      cancelButtonColor: "#858d9b",
      reverseButtons: true,
    });

    if (!result.isConfirmed) {
      return;
    }

    setSelectedPageIndexes([]);
    setModuleDraft((current) => {
      const lessonPages = current.lessonPages.filter(
        (_, index) => !selectedPageIndexes.includes(index),
      );

      const remainingBeforeActive = current.lessonPages.filter(
        (_, index) =>
          index < activePageIndex && !selectedPageIndexes.includes(index),
      ).length;
      setActivePageIndex(
        Math.max(0, Math.min(remainingBeforeActive, lessonPages.length - 1)),
      );

      return {
        ...current,
        lessonPages,
      };
    });
  };

  const updateQuizItem = (quizIndex, field, value) => {
    if (baselinePreview) {
      setMainQuizConfig((current) => ({
        ...current,
        baselineQuestions: current.baselineQuestions.map((item, index) =>
          index === quizIndex ? { ...item, [field]: value } : item,
        ),
      }));
      return;
    }
    setModuleDraft((current) => ({
      ...current,
      mainQuizItems: (current.mainQuizItems || []).map((item, index) =>
        index === quizIndex
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    }));
  };

  const updateQuizOption = (quizIndex, optionIndex, value) => {
    if (baselinePreview) {
      setMainQuizConfig((current) => ({
        ...current,
        baselineQuestions: current.baselineQuestions.map((item, index) => {
          if (index !== quizIndex) return item;
          const oldOption = item.options[optionIndex];
          return {
            ...item,
            options: item.options.map((option, i) =>
              i === optionIndex ? value : option,
            ),
            correct_answer:
              item.correct_answer === oldOption ? value : item.correct_answer,
          };
        }),
      }));
      return;
    }
    setModuleDraft((current) => ({
      ...current,
      mainQuizItems: (current.mainQuizItems || []).map((item, index) => {
        if (index !== quizIndex) {
          return item;
        }

        const oldOption = item.options[optionIndex];
        const options = item.options.map((option, currentOptionIndex) =>
          currentOptionIndex === optionIndex ? value : option,
        );

        return {
          ...item,
          options,
          correct_answer:
            item.correct_answer === oldOption ? value : item.correct_answer,
        };
      }),
    }));
  };

  const addQuizItem = () => {
    if (baselinePreview) {
      if (mainQuizConfig.baselineQuestions.length >= 100) return;
      setActiveQuizIndex(mainQuizConfig.baselineQuestions.length);
      setMainQuizConfig((current) => ({
        ...current,
        baselineQuestions: [
          ...current.baselineQuestions,
          createEmptyQuizItem(),
        ],
      }));
      return;
    }
    setModuleDraft((current) => {
      if ((current.mainQuizItems || []).length >= 100) return current;
      const quizItems = [
        ...(current.mainQuizItems || []),
        createEmptyQuizItem(),
      ];
      setActiveQuizIndex(quizItems.length - 1);
      return {
        ...current,
        mainQuizItems: quizItems,
      };
    });
  };

  const removeQuizItems = async (indexes) => {
    if (viewingGeneratedMain || !indexes.length) {
      return;
    }

    const result = await Swal.fire({
      icon: "warning",
      title:
        indexes.length === 1
          ? "Remove Question?"
          : "Remove Selected Questions?",
      text: `${indexes.length} question(s) will be removed from the module.`,
      showCancelButton: true,
      confirmButtonText:
        indexes.length === 1 ? "Remove Question" : "Remove Selected",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#d93025",
      cancelButtonColor: "#858d9b",
      reverseButtons: true,
    });

    if (!result.isConfirmed) {
      return;
    }

    const removedIndexes = new Set(indexes);
    setSelectedQuestionIndexes([]);
    if (baselinePreview) {
      setMainQuizConfig((current) => ({
        ...current,
        baselineQuestions: current.baselineQuestions.filter(
          (_, index) => !removedIndexes.has(index),
        ),
      }));
      setActiveQuizIndex(0);
      return;
    }

    setModuleDraft((current) => {
      const quizItems = (current.mainQuizItems || []).filter(
        (_, index) => !removedIndexes.has(index),
      );

      setActiveQuizIndex(
        quizItems.length ? Math.min(activeQuizIndex, quizItems.length - 1) : 0,
      );

      return {
        ...current,
        mainQuizItems: quizItems,
      };
    });
  };

  const autoGenerateQuiz = async () => {
    if (!moduleDraft) {
      return;
    }

    const lessonContent = moduleDraft.lessonPages
      .map((page) =>
        [String(page.title || "").trim(), String(page.content || "").trim()]
          .filter(Boolean)
          .join("\n"),
      )
      .filter(Boolean)
      .join("\n\n");

    if (!lessonContent && !moduleDraft.learningObjectives.trim()) {
      await Swal.fire({
        icon: "warning",
        title: "Module Content Required",
        text: "Add learning objectives or lesson pages to this module first.",
        confirmButtonText: "OK",
      });

      return;
    }

    const result = await requestQuizSettings({ assessment: "main" });

    if (!result.isConfirmed || !result.value) {
      return;
    }

    try {
      setGeneratingQuiz(true);
      Swal.fire({
        title: "Generating Main Quiz",
        text: "Saving settings and generating lesson-based questions for review.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });
      await saveCourse(buildUpdatedCourse(), { fallback: false });
      const response = await fetch(`${API_BASE}/lessons/main-quiz/config`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...lessonAuthHeaders(),
        },
        body: JSON.stringify({
          ...quizSourceFields(
            courseDraft?.id || id,
            moduleId,
            moduleDraft.lessonPages,
          ),
          module_id: String(moduleId),
          module_index: moduleDraft.moduleIndex ?? moduleDraft.module_index,
          lesson_title: moduleDraft.title,
          learning_objectives: moduleDraft.learningObjectives,
          ...quizGenerationFields(result.value),
        }),
      });
      const data = await response.json().catch(() => {
        throw Error(
          "Main Quiz service returned an empty or invalid response. Check that the backend is running, then reload.",
        );
      });
      if (!response.ok || !data.success)
        throw new Error(
          data.message || "Could not save Main Quiz configuration.",
        );
      setMainQuizConfig(data.config);
      setMainConfigError("");
      setGeneratedMainQuizzes([]);
      setSelectedMainQuiz(-1);
      const previewResponse = await fetch(
        `${API_BASE}/lessons/main-quiz/preview`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...lessonAuthHeaders(),
          },
          body: JSON.stringify({
            course_id: courseDraft?.id || id,
            module_id: String(moduleId),
          }),
        },
      );
      const previewData = await previewResponse.json();
      if (!previewResponse.ok || !previewData.success)
        throw new Error(
          previewData.message ||
            "Settings saved, but Main Quiz questions could not be generated. Try Auto Generate again.",
        );
      setMainQuizConfig(previewData.config);
      setActiveQuizIndex(0);
      await Swal.fire({
        icon: "success",
        title: "Main Quiz generated",
        text: "Lesson-based questions are ready to review. Students can start without Practice Quiz; completed practice results personalize their questions.",
      });
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "Configuration failed",
        text: error.message,
      });
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const openMainQuizEditor = () => {
    const updatedCourse = buildUpdatedCourse();
    writeCourseBuilderDraft(id, updatedCourse);
    navigate(quizModulePath + "/main-quiz/edit", {
      state: { courseDraft: updatedCourse },
    });
  };

  const handleGenerateModule = async () => {
    if (!uploadedFile.length) {
      await Swal.fire({
        icon: "warning",
        title: "No File Selected",
        text: "Please choose PDF, PPT, PPTX, DOCX, or TXT lesson files first.",
        confirmButtonText: "OK",
      });

      return;
    }

    try {
      setProcessingFile(true);
      setGenerationProgress("Preparing your course draft…");
      const generationCourse = await ensureGenerationCourse(
        buildUpdatedCourse(),
        id,
        generationCourseRef,
        saveCourse,
      );
      if (String(generationCourse.id) !== String(id)) {
        setCourseDraft(generationCourse);
        writeCourseBuilderDraft(id, generationCourse);
        writeCourseBuilderDraft(generationCourse.id, generationCourse);
      }
      const formData = new FormData();
      formData.append("course_id", generationCourse.id);
      formData.append("client_module_key", moduleId);
      if (Number.isInteger(Number(moduleId)) && Number(moduleId) > 0)
        formData.append("lesson_id", moduleId);
      uploadedFile.forEach((file) => formData.append("files", file));

      const data = await uploadLessonSource(formData, (job) =>
        setGenerationProgress(`${job.progress}% — ${job.phase}`),
      );

      if (!data.success) {
        throw new Error(
          data.message || "Could not process the uploaded lesson file.",
        );
      }

      const generatedPages = Array.isArray(data.lesson_pages)
        ? data.lesson_pages
            .map((page) => ({
              ...page,
              id: createId("page"),
              title: limit(page?.title || "", TITLE_LIMIT),
              content: limit(removeLessonPracticeActivities(page?.content), LESSON_LIMIT),
            }))
            .filter((page) => page.title || page.content)
        : [];

      if (generatedPages.length === 0) {
        throw new Error(
          data.message ||
            "The materials uploaded, but no lesson pages were created. Use files containing selectable text.",
        );
      }

      const generatedModule = {
        ...moduleDraft,
        title: limit(data.module_title || moduleDraft.title, TITLE_LIMIT),
        description: limit(
          data.description || moduleDraft.description,
          LONG_LIMIT,
        ),
        learningObjectives: limit(
          data.learning_objectives || moduleDraft.learningObjectives,
          LONG_LIMIT,
        ),
        lessonPages: generatedPages,
      };
      setGenerationProgress("Generating Quick Recap questions…");
      const recap = await generateModuleRecap({
        courseId: generationCourse.id, moduleId, title: generatedModule.title,
        objectives: generatedModule.learningObjectives, pages: generatedPages,
        existing: moduleDraft.quizItems || [],
      });
      generatedModule.quizItems = recap.questions.map(normalizeQuizItem);
      const nextCourse = {
        ...generationCourse,
        subject: limit(data.subject || generationCourse.subject, TITLE_LIMIT),
        contentModules: generationCourse.contentModules.map((module) =>
          String(module.id) === String(moduleId) ? generatedModule : module,
        ),
      };
      setCourseDraft(nextCourse);
      setModuleDraft(generatedModule);
      writeCourseBuilderDraft(generationCourse.id, nextCourse);
      if (String(generationCourse.id) !== String(id))
        navigate(
          `/professor/courses/edit/${generationCourse.id}/modules/${encodeURIComponent(moduleId)}/edit`,
          { replace: true, state: { courseDraft: nextCourse } },
        );

      setActivePageIndex(0);

      setGeneratorOpen(false);
      setUploadedFile([]);
      await notifyLessonGenerated(generatedPages);
      if (recap.error) {
        await Swal.fire({
          icon: "warning",
          title: "Lessons ready",
          text: "Quick Recap could not be generated. The system will retry when you save the module.",
        });
      }
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: /couldn.t verify|grounding/i.test(error.message || "")
          ? "Lesson needs another attempt"
          : "Generation Failed",
        text: /couldn.t verify|grounding/i.test(error.message || "")
          ? "Some lesson details could not be verified against your source. Your files are saved. Use Retry with saved sources in the module to try again without uploading them again."
          : error.message || "Could not process the lesson file.",
        confirmButtonText: "OK",
      });
    } finally {
      setProcessingFile(false);
    }
  };

  const buildUpdatedCourse = (updatedModule = moduleDraft) => ({
    ...courseDraft,
    contentModules: courseDraft.contentModules.map((module) =>
      String(module.id) === String(moduleId) ? updatedModule : module,
    ),
  });

  const saveModule = async () => {
    if (isQuizWorkspace && isMainAssessment && assessmentItems.length === 0) {
      await Swal.fire({
        icon: "warning",
        title: "Questions Required",
        text: "Please add at least one question before saving the Main Quiz.",
        confirmButtonText: "OK",
      });
      return;
    }

    if (isQuizWorkspace && isMainAssessment) {
      const seenQuestions = new Set();
      for (const [index, question] of assessmentItems.entries()) {
        const text = String(question.question || "").trim();
        const options = question.options || [];
        const answer = String(question.correct_answer || "").trim();
        const acceptedAnswers = normalizeAcceptedAnswers(
          question.accepted_answers,
        );
        let title = "Required Fields";
        let message = "";

        if (!text) {
          message = "Please enter the question.";
        } else if (seenQuestions.has(text.toLowerCase())) {
          title = "Duplicate Question";
          message =
            "Please use a different question. This question is already in the quiz.";
        } else if (
          question.type === "multiple_choice" &&
          (options.length !== 4 ||
            options.some((option) => !String(option).trim()))
        ) {
          message = "Please fill in all four answer choices.";
        } else if (
          question.type === "multiple_choice" &&
          new Set(options).size !== options.length
        ) {
          title = "Duplicate Answer Choices";
          message = "Please enter four different answer choices.";
        } else if (
          !answer ||
          (question.type !== "identification" &&
            !options.includes(question.correct_answer))
        ) {
          message = "Please enter or select the correct answer.";
        } else if (
          question.type === "identification" &&
          (acceptedAnswers.length > 20 ||
            acceptedAnswers.some((accepted) => accepted.length > 150) ||
            acceptedAnswers.some(
              (accepted) =>
                accepted.normalize("NFKC").replace(/\s+/g, " ").toLowerCase() ===
                answer.normalize("NFKC").replace(/\s+/g, " ").toLowerCase(),
            ))
        ) {
          title = "Invalid Alternative Answers";
          message =
            "Use up to 20 distinct alternatives, each 150 characters or fewer, and keep them different from the correct answer.";
        }

        if (message) {
          setActiveQuizIndex(index);
          await Swal.fire({
            icon: "warning",
            title,
            text: `Question ${index + 1}: ${message}`,
            confirmButtonText: "OK",
          });
          return;
        }
        seenQuestions.add(text.toLowerCase());
      }
    }

    if (!moduleDraft.title.trim()) {
      await Swal.fire({
        icon: "warning",
        title: "Module Title Required",
        text: "Please enter a module title.",
        confirmButtonText: "OK",
      });

      return;
    }

    const savedId = courseDraft.id || id;
    let recapError = "";
    let updatedModule = moduleDraft;
    if (
      !isQuizWorkspace &&
      Number(savedId) > 0 &&
      !moduleDraft.quizItems.length &&
      moduleDraft.lessonPages.some((page) => String(page.content || "").trim())
    ) {
      Swal.fire({
        title: "Generating Quick Recap",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });
      const recap = await generateModuleRecap({
        courseId: savedId,
        moduleId,
        title: moduleDraft.title,
        objectives: moduleDraft.learningObjectives,
        pages: moduleDraft.lessonPages,
      });
      recapError = recap.error || "";
      updatedModule = {
        ...moduleDraft,
        quizItems: recap.questions.map(normalizeQuizItem),
      };
    }
    const updatedCourse = buildUpdatedCourse(updatedModule);
    writeCourseBuilderDraft(id, updatedCourse);

    if (
      id ||
      (Number.isSafeInteger(Number(updatedCourse.id)) &&
        Number(updatedCourse.id) > 0)
    ) {
      try {
        if (isMainAssessment && mainQuizConfig?.baselineQuestions) {
          const response = await fetch(
            `${API_BASE}/lessons/main-quiz/preview`,
            {
              method: "PUT",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                ...lessonAuthHeaders(),
              },
              body: JSON.stringify({
                course_id: updatedCourse.id || id,
                module_id: String(moduleId),
                questions: mainQuizConfig.baselineQuestions,
              }),
            },
          );
          const data = await response.json();
          if (!response.ok || !data.success)
            throw new Error(
              data.message || "Could not save Main Quiz questions.",
            );
          setMainQuizConfig(data.config);
        }
        await saveCourse(updatedCourse);
      } catch (error) {
        await Swal.fire({
          icon: "error",
          title: "Save Failed",
          text:
            error?.message ||
            "Could not save the module changes to the course.",
          confirmButtonText: "OK",
        });

        return;
      }
    }

    await Swal.fire({
      icon: "success",
      title: isQuizWorkspace ? "Quiz Saved" : "Module Saved",
      text: isQuizWorkspace
        ? "Your quiz changes have been saved."
        : recapError
          ? "Your module was saved. Quick Recap could not be generated, so the first practice will cover the module broadly."
          : "Your module changes were added back to the course.",
      confirmButtonText: "Done",
    });

    navigate(
      isQuizWorkspace
        ? quizModulePath
        : updatedCourse.id
          ? `/professor/courses/edit/${updatedCourse.id}`
          : builderPath,
      {
        state: {
          courseDraft: updatedCourse,
        },
      },
    );
  };

  const cancelEdit = () => {
    if (courseDraft) {
      writeCourseBuilderDraft(id, courseDraft);
    }

    navigate(
      isQuizWorkspace
        ? `/professor/quizzes?course=${encodeURIComponent(id || "")}`
        : builderPath,
      {
        state: {
          courseDraft,
        },
      },
    );
  };

  if (loading || !moduleDraft) {
    return (
      <div
        className={`${styles.addModulePage} ${styles.courseModuleEditorPage} course-module-editor-page`}
      >
        <main className={styles.moduleEditorLoading}>
          <LoadingState />
        </main>
      </div>
    );
  }

  return (
    <div
      className={`${styles.addModulePage} ${styles.courseModuleEditorPage} ${isMainAssessment ? styles.assessmentPage : ""} course-module-editor-page`}
    >
      <ManagementBackBar
        onClick={() => {
          const updatedCourse = buildUpdatedCourse();
          writeCourseBuilderDraft(id, updatedCourse);
          navigate(
            isQuizWorkspace
              ? `/professor/quizzes?course=${encodeURIComponent(id || "")}`
              : builderPath,
            { state: { courseDraft: updatedCourse } },
          );
        }}
      >
        Back to modules
      </ManagementBackBar>
      <div className={styles.pageHeader}>
        <h1>
          {isMainAssessment
            ? "Main Quiz Editor"
            : quizManagement
              ? `Quiz Management · ${moduleDraft.title}`
              : "Edit Module"}
        </h1>
        <p className={styles.pageHeaderText}>
          {isMainAssessment
            ? "Edit the Main Quiz for this module."
            : quizManagement
              ? "Manage the Main Quiz for this module."
              : "Build lesson pages for this course module."}
        </p>
        {isMainAssessment && (
          <p className={styles.pageHeaderText}>
            Auto Generate creates lesson-based questions to review. Students
            receive personalized questions using completed Practice Quiz results
            when available; practice is optional.
          </p>
        )}
        {isMainAssessment && (
          <div className={styles.assessmentHeaderActions}>
            <button
              className={styles.assessmentPrintButton}
              type="button"
              aria-label="Print main quiz"
              onClick={() => window.print()}
            >
              Print
            </button>
            <button
              className={styles.assessmentSettingsButton}
              type="button"
              data-tutorial="main-quiz-settings"
              onClick={() => mainQuizSettingsDialog.current?.showModal()}
            >
              Main Quiz Settings
            </button>
          </div>
        )}
        {!isQuizWorkspace && (
          <button
            className={styles.assessmentSettingsButton}
            type="button"
            data-tutorial="generate-module-button"
            onClick={() => setGeneratorOpen(true)}
          >
            Generate Module
          </button>
        )}
      </div>

      <main className={styles.moduleEditorForm}>
        {!isQuizWorkspace && (
          <>
            {generatorOpen &&
              createPortal(
                <div
                  className={styles.courseModuleEditorPage}
                  style={{ display: "contents" }}
                >
                  <div
                    className={styles.generatorOverlay}
                    onClick={(event) => {
                      if (event.target === event.currentTarget)
                        setGeneratorOpen(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setGeneratorOpen(false);
                      if (event.key === "Tab") {
                        const controls = [
                          ...event.currentTarget.querySelectorAll(
                            "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, a[href]",
                          ),
                        ].filter((element) => element.getClientRects().length);
                        const first = controls[0],
                          last = controls.at(-1);
                        if (
                          event.shiftKey &&
                          document.activeElement === first
                        ) {
                          event.preventDefault();
                          last?.focus();
                        } else if (
                          !event.shiftKey &&
                          document.activeElement === last
                        ) {
                          event.preventDefault();
                          first?.focus();
                        }
                      }
                    }}
                  >
                    <div
                      role="dialog"
                      aria-modal="true"
                      className={styles.generateModuleDialog}
                      aria-labelledby="generate-module-title"
                    >
                      <section className={styles.moduleMaterialBand}>
                        <button
                          type="button"
                          className={styles.settingsDialogClose}
                          aria-label="Close module generator"
                          autoFocus
                          onClick={() => setGeneratorOpen(false)}
                        >
                          ×
                        </button>
                        <h2 id="generate-module-title">
                          Organize Learning Module
                        </h2>
                        <p>
                          Upload your learning material and PuffyBrain will
                          organize the content into lesson pages automatically.
                        </p>

                        <div className={styles.generatorFilePicker}>
                          <LessonFilePicker
                            files={uploadedFile}
                            disabled={processingFile}
                            buttonClassName={styles.customFileBtn}
                            onChange={setUploadedFile}
                          />
                        </div>

                        {processingFile && (
                          <p role="status">
                            {generationProgress || "Queuing materials..."}
                          </p>
                        )}
                        <LessonSourceManager
                          courseId={id}
                          jobScope={moduleId}
                          lessonId={
                            Number.isInteger(Number(moduleId)) &&
                            Number(moduleId) > 0
                              ? Number(moduleId)
                              : null
                          }
                          onGenerated={(result) => {
                            setModuleDraft((current) => ({
                              ...current,
                              title: result.module_title,
                              description: result.description,
                              learningObjectives: result.learning_objectives,
                              lessonPages: result.lesson_pages.map((page) => ({
                                ...page,
                                id: createId("page"),
                              })),
                            }));
                            setCourseDraft((current) => ({
                              ...current,
                              subject: result.subject,
                            }));
                            setActivePageIndex(0);
                            setGeneratorOpen(false);
                            setUploadedFile([]);
                          }}
                        />
                      </section>
                      <div className={styles.generatorDialogFooter}>
                        <button
                          type="button"
                          className={styles.generatorCancel}
                          onClick={() => setGeneratorOpen(false)}
                        >
                          Cancel
                        </button>
                        <button
                          className={styles.popupAddBtn}
                          type="button"
                          onClick={handleGenerateModule}
                          disabled={processingFile || !uploadedFile.length}
                        >
                          {processingFile ? "Generating..." : "Generate Module"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>,
                document.body,
              )}

            <section className={styles.moduleEditorDetails}>
              <div className={styles.popupField}>
                <label className={styles.popupLabel}>
                  Module Title{" "}
                  <span className={styles.required}>*required</span>
                </label>
                <input
                  className={styles.popupInput}
                  value={moduleDraft.title}
                  onChange={(event) =>
                    updateModuleField(
                      "title",
                      limit(event.target.value, TITLE_LIMIT),
                    )
                  }
                  placeholder="Enter module title"
                />
              </div>

              <div className={styles.popupField}>
                <label className={styles.popupLabel}>
                  Module Description{" "}
                  <span className={styles.required}>*required</span>
                </label>
                <input
                  className={styles.popupInput}
                  value={moduleDraft.description}
                  onChange={(event) =>
                    updateModuleField(
                      "description",
                      limit(event.target.value, LONG_LIMIT),
                    )
                  }
                  placeholder="Enter module description"
                />
              </div>

              <div
                className={`${styles.popupField} ${styles.moduleEditorObjectives}`}
              >
                <label className={styles.popupLabel}>
                  Learning Objectives{" "}
                  <span className={styles.required}>*required</span>
                </label>
                <textarea
                  className={`${styles.popupTextarea} ${styles.popupSmallBox}`}
                  value={moduleDraft.learningObjectives}
                  onChange={(event) =>
                    updateModuleField(
                      "learningObjectives",
                      limit(event.target.value, LONG_LIMIT),
                    )
                  }
                  placeholder="Enter learning objectives"
                />
              </div>
            </section>
          </>
        )}

        {!isQuizWorkspace && (
          <section
            className={`${styles.moduleEditorBand} ${styles.lessonPageEditor}`}
            data-tutorial="module-lesson-pages"
          >
            <div className={styles.moduleEditorBandHeader}>
              <div>
                <h2>Lesson Pages</h2>
                <p>Pages belonging only to this module.</p>
              </div>

              <div className={styles.moduleEditorBandActions}>
                <button
                  className={styles.popupAddBtn}
                  type="button"
                  onClick={addLessonPage}
                >
                  + Add Page
                </button>
              </div>
            </div>

            <div className={styles.moduleEditorWorkspace}>
              <div className={styles.popupQuizCard}>
                {activePage ? (
                  <>
                    <div
                      className={`${styles.questionSelectionControls} ${styles.lessonSelectionControls}`}
                    >
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedPageIndexes.length === lessonCount}
                          ref={(element) => {
                            if (element)
                              element.indeterminate =
                                selectedPageIndexes.length > 0 &&
                                selectedPageIndexes.length < lessonCount;
                          }}
                          onChange={(event) =>
                            setSelectedPageIndexes(
                              event.target.checked
                                ? moduleDraft.lessonPages.map(
                                    (_, index) => index,
                                  )
                                : [],
                            )
                          }
                        />
                        Select All
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedPageIndexes.includes(activePageIndex)}
                          onChange={(event) =>
                            setSelectedPageIndexes((current) =>
                              event.target.checked
                                ? [...current, activePageIndex]
                                : current.filter(
                                    (index) => index !== activePageIndex,
                                  ),
                            )
                          }
                        />
                        Select This Page
                      </label>
                      <button
                        type="button"
                        className={styles.popupAddBtn}
                        disabled={!selectedPageIndexes.length}
                        onClick={removeSelectedLessonPages}
                      >
                        Remove Selected ({selectedPageIndexes.length})
                      </button>
                    </div>

                    <label className={styles.popupLabel}>
                      Page Title{" "}
                      <span className={styles.required}>*required</span>
                    </label>
                    <input
                      className={styles.popupInput}
                      value={activePage.title}
                      onChange={(event) =>
                        updateLessonPage(
                          activePageIndex,
                          "title",
                          limit(event.target.value, TITLE_LIMIT),
                        )
                      }
                      placeholder="Enter page title"
                    />

                    <div className={styles.lessonContentHeading}>
                      <label className={styles.popupLabel}>
                        Content{" "}
                        <span className={styles.required}>*required</span>
                      </label>

                      <label className={styles.uploadMediaBtn}>
                        Upload Photo/Video
                        <input
                          type="file"
                          accept="image/*,video/*"
                          onChange={handlePageMediaSelected}
                        />
                      </label>
                    </div>

                    {activePageMedia && (
                      <div className={styles.lessonMediaPreview}>
                        <div className={styles.lessonMediaFrame}>
                          {activePageMedia.type.startsWith("video/") ? (
                            <video src={activePageMedia.url} controls />
                          ) : (
                            <img
                              src={activePageMedia.url}
                              alt={activePageMedia.name}
                            />
                          )}
                        </div>

                        <span>{activePageMedia.name}</span>
                      </div>
                    )}

                    <LessonContentEditor
                      key={activePage.id || activePageIndex}
                      className={`${styles.popupTextarea} ${styles.popupLargeBox}`}
                      value={activePage.content}
                      onChange={(event) =>
                        updateLessonPage(
                          activePageIndex,
                          "content",
                          limit(event.target.value, LESSON_LIMIT),
                        )
                      }
                      placeholder="Enter page content"
                    />
                    <LessonSourceEvidence page={activePage} />

                    <nav
                      className={styles.lessonPageNavigation}
                      aria-label="Lesson pages"
                    >
                      <button
                        className={styles.lessonNavigationBtn}
                        type="button"
                        onClick={() =>
                          setActivePageIndex((current) =>
                            Math.max(0, current - 1),
                          )
                        }
                        disabled={!canMovePrevious}
                      >
                        Previous
                      </button>

                      <div className={styles.lessonPageNumbers}>
                        {lessonPageNumbers.map((page) => (
                          <button
                            key={page}
                            type="button"
                            aria-label={`Page ${page}`}
                            aria-current={
                              page === activePageIndex + 1 ? "page" : undefined
                            }
                            onClick={() => setActivePageIndex(page - 1)}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <button
                        className={styles.lessonNavigationBtn}
                        type="button"
                        onClick={() =>
                          setActivePageIndex((current) =>
                            Math.min(lessonCount - 1, current + 1),
                          )
                        }
                        disabled={!canMoveNext}
                      >
                        Next
                      </button>
                    </nav>
                  </>
                ) : (
                  <div className={styles.popupEmptyQuiz}>
                    Add a lesson page to begin.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {isQuizWorkspace && (
          <section className={styles.moduleEditorBand}>
            {!isMainAssessment && (
              <div className={styles.moduleEditorBandHeader}>
                <div>
                  <h2>Module Assessments</h2>
                  <p>
                    The system creates each student’s adaptive Practice Quiz.
                  </p>
                </div>
              </div>
            )}

            {!isMainAssessment ? (
              <div className={styles.moduleAssessmentGrid}>
                <article
                  className={styles.moduleAssessmentCard}
                >
                  <span
                    className={styles.assessmentFolderAccent}
                    aria-hidden="true"
                  >
                    +
                  </span>
                  <div>
                    <h3>Main Quiz</h3>
                    <p>
                      {mainQuizConfig
                        ? `${mainQuizConfig.questionCount} Personalized Questions`
                        : "Not configured yet"}
                    </p>
                    <p>
                      Passing Score: {mainQuizConfig?.passingPercentage ?? 60}%
                    </p>
                    <p>
                      Status:{" "}
                      {mainQuizSettings.enabled
                        ? mainQuizUnlockLabel
                          ? `Opens ${mainQuizUnlockLabel}`
                          : "Available now"
                        : "Disabled"}
                    </p>
                  </div>

                  <div className={styles.assessmentCardFooter}>
                    <button
                      className={styles.assessmentEditButton}
                      type="button"
                      onClick={openMainQuizEditor}
                    >
                      Edit Main Quiz
                    </button>
                  </div>
                </article>
              </div>
            ) : (
              <div className={styles.moduleAssessmentEditor}>
                {isMainAssessment && (
                  <dialog
                    ref={mainQuizSettingsDialog}
                    className={styles.mainQuizSettingsDialog}
                    aria-labelledby="main-quiz-access-title"
                    onClick={(event) => {
                      if (
                        !tutorialSettingsPreview &&
                        event.target === event.currentTarget
                      )
                        event.currentTarget.close();
                    }}
                    onCancel={(event) => {
                      if (tutorialSettingsPreview) event.preventDefault();
                    }}
                  >
                    <div className={styles.mainQuizSettingsPanel}>
                      {!tutorialSettingsPreview && (
                        <button
                          type="button"
                          className={styles.settingsDialogClose}
                          aria-label="Close main quiz settings"
                          onClick={() => mainQuizSettingsDialog.current?.close()}
                        >
                          ×
                        </button>
                      )}
                      <div>
                        <h4 id="main-quiz-access-title">Main Quiz Access</h4>
                        <p>
                          Lock or unlock the main quiz and set when student
                          access opens and closes.
                        </p>
                      </div>
                      {tutorialSettingsPreview && (
                        <div id="main-quiz-settings-tutorial" />
                      )}

                      <div
                        className={styles.mainQuizSettingsControls}
                        data-tutorial="main-quiz-access-controls"
                      >
                        <button
                          className={`${styles.mainQuizToggle} ${
                            mainQuizSettings.enabled
                              ? styles.mainQuizToggleOn
                              : styles.mainQuizToggleOff
                          }`}
                          type="button"
                          aria-pressed={!mainQuizSettings.enabled}
                          disabled={tutorialSettingsPreview}
                          onClick={() =>
                            updateMainQuizSettings(
                              "enabled",
                              !mainQuizSettings.enabled,
                            )
                          }
                        >
                          {mainQuizSettings.enabled
                            ? "Lock Main Quiz"
                            : "Unlock Main Quiz"}
                        </button>

                        <label className={styles.mainQuizTimerField}>
                          Unlock date and time
                          <input
                            className={styles.popupInput}
                            type="datetime-local"
                            value={mainQuizSettings.unlockAt}
                            disabled={tutorialSettingsPreview}
                            onChange={(event) =>
                              updateMainQuizSettings(
                                "unlockAt",
                                event.target.value,
                              )
                            }
                          />
                        </label>

                        <button
                          className={styles.assessmentBackButton}
                          type="button"
                          onClick={() => updateMainQuizSettings("unlockAt", "")}
                          disabled={tutorialSettingsPreview || !mainQuizSettings.unlockAt}
                        >
                          Clear Unlock Date
                        </button>
                        <label className={styles.mainQuizTimerField}>
                          Lock date and time
                          <input
                            className={styles.popupInput}
                            type="datetime-local"
                            value={mainQuizSettings.lockAt}
                            min={mainQuizSettings.unlockAt || undefined}
                            disabled={tutorialSettingsPreview}
                            onChange={(event) =>
                              updateMainQuizSettings(
                                "lockAt",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <button
                          className={styles.assessmentBackButton}
                          type="button"
                          onClick={() => updateMainQuizSettings("lockAt", "")}
                          disabled={tutorialSettingsPreview || !mainQuizSettings.lockAt}
                        >
                          Clear Lock Date
                        </button>
                      </div>

                      <p className={styles.mainQuizAccessHint}>
                        {mainQuizSettings.enabled
                          ? mainQuizUnlockLabel
                            ? `Scheduled access opens on ${mainQuizUnlockLabel} and closes at the lock date, if set.`
                            : "Unlocked — students can access the main quiz after they finish the module."
                          : "Locked — students cannot access the main quiz. Click Unlock Main Quiz to allow access."}
                      </p>
                      {mainQuizSettings.lockAt && (
                        <p className={styles.mainQuizAccessHint}>
                          Student access closes on{" "}
                          {formatDateTimeLabel(mainQuizSettings.lockAt)}.
                        </p>
                      )}
                      {!tutorialSettingsPreview && (
                        <button
                          type="button"
                          className={styles.assessmentSettingsButton}
                          onClick={() => mainQuizSettingsDialog.current?.close()}
                        >
                          Done
                        </button>
                      )}
                    </div>
                  </dialog>
                )}

                <div className={styles.moduleEditorWorkspace}>
                  <div className={styles.lessonPageTabs}>
                    {quizCount === 0 ? (
                      <span className={styles.moduleEditorEmptyTab}>
                        No quiz
                      </span>
                    ) : (
                      <>
                        {!viewingGeneratedMain && (
                          <div className={styles.questionSelectionControls}>
                            <label>
                              <input
                                type="checkbox"
                                checked={
                                  selectedQuestionIndexes.length === quizCount
                                }
                                ref={(element) => {
                                  if (element)
                                    element.indeterminate =
                                      selectedQuestionIndexes.length > 0 &&
                                      selectedQuestionIndexes.length <
                                        quizCount;
                                }}
                                onChange={(event) =>
                                  setSelectedQuestionIndexes(
                                    event.target.checked
                                      ? assessmentItems.map((_, index) => index)
                                      : [],
                                  )
                                }
                              />
                              Select All
                            </label>
                            <button
                              type="button"
                              className={styles.popupAddBtn}
                              disabled={!selectedQuestionIndexes.length}
                              onClick={() =>
                                removeQuizItems(selectedQuestionIndexes)
                              }
                            >
                              Remove Selected ({selectedQuestionIndexes.length})
                            </button>
                          </div>
                        )}
                        {visibleQuizItems.map((item, offset) => {
                          const index = activeQuizPageStart + offset;

                          return (
                            <div
                              key={item.id || index}
                              className={styles.questionSelectionRow}
                            >
                              {!viewingGeneratedMain && (
                                <input
                                  type="checkbox"
                                  aria-label={`Select question ${index + 1}`}
                                  checked={selectedQuestionIndexes.includes(
                                    index,
                                  )}
                                  onChange={(event) =>
                                    setSelectedQuestionIndexes((current) =>
                                      event.target.checked
                                        ? [...current, index]
                                        : current.filter(
                                            (value) => value !== index,
                                          ),
                                    )
                                  }
                                />
                              )}
                              <button
                                type="button"
                                className={`${styles.lessonPageTab} ${
                                  index === activeQuizIndex
                                    ? styles.lessonPageTabActive
                                    : ""
                                }`}
                                onClick={() => setActiveQuizIndex(index)}
                              >
                                Question {index + 1}
                              </button>
                            </div>
                          );
                        })}

                        {quizCount > QUIZ_TAB_PAGE_SIZE && (
                          <div className={styles.questionTabPager}>
                            <div className={styles.questionTabPagerControls}>
                              <button
                                type="button"
                                onClick={goToPreviousQuizPage}
                                disabled={!canShowPreviousQuizPage}
                              >
                                Previous
                              </button>

                              <button
                                type="button"
                                onClick={goToNextQuizPage}
                                disabled={!canShowNextQuizPage}
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div
                    className={`${styles.popupQuizCard} ${styles.moduleQuizEditorCard}`}
                  >
                    <div className={styles.quizEditorToolbar}>
                      <h2>Question</h2>
                      <div className={styles.moduleEditorBandActions}>
                        <button
                          className={styles.popupAddBtn}
                          type="button"
                          data-tutorial="add-main-quiz-question"
                          onClick={addQuizItem}
                          disabled={viewingGeneratedMain}
                        >
                          + Add Question
                        </button>

                        <button
                          className={styles.popupAddBtn}
                          type="button"
                          data-tutorial="auto-generate-main-quiz"
                          onClick={autoGenerateQuiz}
                          disabled={generatingQuiz}
                        >
                          {generatingQuiz ? "Generating Main Quiz…" : "Auto Generate"}
                        </button>
                      </div>
                    </div>
                    <div className={styles.quizEditorFields}>
                      {activeQuiz ? (
                        <fieldset
                          disabled={viewingGeneratedMain}
                          style={{ border: 0, padding: 0, margin: 0 }}
                        >
                          <label className={styles.popupLabel}>
                            Question{" "}
                            <span className={styles.required}>*required</span>
                          </label>
                          <input
                            className={styles.popupInput}
                            value={activeQuiz.question}
                            onChange={(event) =>
                              updateQuizItem(
                                activeQuizIndex,
                                "question",
                                limit(event.target.value, QUIZ_LIMIT),
                              )
                            }
                            placeholder="Enter question"
                          />

                          <label
                            className={styles.popupLabel}
                            htmlFor="main-quiz-question-topic"
                          >
                            Topic
                          </label>
                          {viewingGeneratedMain ? (
                            <p className={styles.quizReviewValue}>
                              {activeQuiz.topic || "General Concepts"}
                            </p>
                          ) : (
                            <>
                              <input
                                id="main-quiz-question-topic"
                                className={styles.popupInput}
                                list="main-quiz-topic-options"
                                value={activeQuiz.topic || ""}
                                onChange={(event) =>
                                  updateQuizItem(
                                    activeQuizIndex,
                                    "topic",
                                    limit(event.target.value, 100),
                                  )
                                }
                                placeholder="Enter a specific topic"
                                maxLength={100}
                              />
                              <datalist id="main-quiz-topic-options">
                                {(moduleDraft?.topics || []).map((topic) => (
                                  <option key={topic} value={topic} />
                                ))}
                              </datalist>
                              <p className={styles.quizReviewValue}>
                                Use the question's specific lesson topic so it is grouped correctly in the TOS.
                              </p>
                            </>
                          )}

                          <label
                            className={styles.popupLabel}
                            htmlFor="quiz-question-type"
                          >
                            Question type
                          </label>
                          {viewingGeneratedMain ? (
                            <p className={styles.quizReviewValue}>
                              {{
                                multiple_choice: "Multiple Choice",
                                identification: "Identification",
                                true_false: "True or False",
                              }[activeQuiz.type] || activeQuiz.type}
                            </p>
                          ) : (
                            <select
                              id="quiz-question-type"
                              className={styles.popupSelect}
                              value={activeQuiz.type}
                              onChange={(event) => {
                                const type = event.target.value;
                                updateQuizItem(activeQuizIndex, "type", type);
                                if (type !== "identification") {
                                  updateQuizItem(
                                    activeQuizIndex,
                                    "accepted_answers",
                                    [],
                                  );
                                }
                                updateQuizItem(
                                  activeQuizIndex,
                                  "options",
                                  type === "identification"
                                    ? []
                                    : type === "true_false"
                                      ? ["True", "False"]
                                      : ["", "", "", ""],
                                );
                                updateQuizItem(
                                  activeQuizIndex,
                                  "correct_answer",
                                  "",
                                );
                              }}
                            >
                              <option value="multiple_choice">
                                Multiple Choice
                              </option>
                              <option value="identification">
                                Identification
                              </option>
                              <option value="true_false">True or False</option>
                            </select>
                          )}

                          {activeQuiz.type !== "identification" && (
                            <label className={styles.popupLabel}>
                              Answer choices
                            </label>
                          )}
                          <div className={styles.optionsGrid}>
                            {activeQuiz.options.map((option, optionIndex) => (
                              <input
                                key={optionIndex}
                                className={styles.popupInput}
                                value={option}
                                disabled={activeQuiz.type === "true_false"}
                                onChange={(event) =>
                                  updateQuizOption(
                                    activeQuizIndex,
                                    optionIndex,
                                    limit(event.target.value, QUIZ_LIMIT),
                                  )
                                }
                                placeholder={`Option ${optionIndex + 1}`}
                                aria-label={`Answer choice ${optionIndex + 1}`}
                              />
                            ))}
                          </div>

                          <label
                            className={styles.popupLabel}
                            htmlFor={
                              viewingGeneratedMain
                                ? undefined
                                : "quiz-correct-answer"
                            }
                          >
                            Correct answer
                          </label>
                          {viewingGeneratedMain ? (
                            <p className={styles.quizReviewValue}>
                              {activeQuiz.correct_answer ||
                                "No correct answer provided"}
                            </p>
                          ) : activeQuiz.type === "identification" ? (
                            <input
                              id="quiz-correct-answer"
                              className={styles.popupInput}
                              value={activeQuiz.correct_answer}
                              onChange={(event) =>
                                updateQuizItem(
                                  activeQuizIndex,
                                  "correct_answer",
                                  event.target.value,
                                )
                              }
                              placeholder="Correct identification answer"
                              aria-label="Correct identification answer"
                              maxLength={150}
                            />
                          ) : (
                            <select
                              id="quiz-correct-answer"
                              className={styles.popupSelect}
                              value={activeQuiz.correct_answer}
                              onChange={(event) =>
                                updateQuizItem(
                                  activeQuizIndex,
                                  "correct_answer",
                                  event.target.value,
                                )
                              }
                            >
                              <option value="">Select correct answer</option>
                              {activeQuiz.options.map((option, optionIndex) => (
                                <option
                                  key={optionIndex}
                                  value={option}
                                  disabled={!String(option || "").trim()}
                                >
                                  {option || `Option ${optionIndex + 1}`}
                                </option>
                              ))}
                            </select>
                          )}

                          {!viewingGeneratedMain &&
                            activeQuiz.type === "identification" && (
                              <>
                                <label
                                  className={styles.popupLabel}
                                  htmlFor="quiz-accepted-answers"
                                >
                                  Other accepted answers (optional)
                                </label>
                                <textarea
                                  id="quiz-accepted-answers"
                                  className={styles.popupTextarea}
                                  value={(activeQuiz.accepted_answers || []).join(
                                    "\n",
                                  )}
                                  onChange={(event) =>
                                    updateQuizItem(
                                      activeQuizIndex,
                                      "accepted_answers",
                                      normalizeAcceptedAnswers(
                                        event.target.value,
                                      ),
                                    )
                                  }
                                  placeholder="Enter one approved alternative per line"
                                  aria-label="Other accepted identification answers, one per line"
                                  maxLength={3039}
                                />
                              </>
                            )}

                          <label
                            className={styles.popupLabel}
                            htmlFor="quiz-answer-explanation"
                          >
                            Explanation
                          </label>
                          <textarea
                            id="quiz-answer-explanation"
                            className={`${styles.popupTextarea} ${styles.popupAnswerBox}`}
                            value={activeQuiz.explanation}
                            onChange={(event) =>
                              updateQuizItem(
                                activeQuizIndex,
                                "explanation",
                                limit(event.target.value, QUIZ_LIMIT),
                              )
                            }
                            placeholder="Explanation"
                          />
                          <QuizSourceEvidence question={activeQuiz} />
                        </fieldset>
                      ) : (
                        <div className={styles.popupEmptyQuiz}>
                          Add a quiz item to begin.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        <div className={styles.moduleEditorActions}>
          <button
            className={styles.popupCancelBtn}
            type="button"
            onClick={cancelEdit}
          >
            Back
          </button>
          {(!isQuizWorkspace || isMainAssessment) && (
            <button
              className={styles.popupSaveBtn}
              type="button"
              onClick={saveModule}
            >
              {isMainAssessment ? "Save Quiz" : "Save Module"}
            </button>
          )}
        </div>
      </main>
      {isMainAssessment && (
        <section
          className={styles.quizPrintSheet}
          aria-label="Printable main quiz"
        >
          <header className={styles.printExamHeader}>
            {moduleDraft.title && <p>{moduleDraft.title}</p>}
            <div className={styles.printStudentFields}>
              <div>
                <strong>Name:</strong>
                <span className={styles.printAnswerLine} />
              </div>
              <div>
                <strong>Date:</strong>
                <span className={styles.printAnswerLine} />
              </div>
              <div>
                <strong>Section:</strong>
                <span className={styles.printAnswerLine} />
              </div>
              <div>
                <strong>Score:</strong>
                <span className={styles.printAnswerLine} />
              </div>
            </div>
          </header>
          {numberedPrintableQuestionGroups.length ? (
            numberedPrintableQuestionGroups.map((group) => (
              <section className={styles.printTestSection} key={group.type}>
                <h2>{group.title}</h2>
                <ol className={styles.printQuestionList}>
                  {group.questions.map(({ question, number }, index) => (
                    <li
                      className={styles.printQuestion}
                      key={question.id || `${group.type}-${index}`}
                    >
                      <p>
                        <span>{number}.</span> {" "}
                        {question.question || "Untitled question"}
                      </p>
                      {question.type === "identification" ? (
                        <span
                          className={styles.printIdentificationLine}
                          aria-hidden="true"
                        />
                      ) : (
                        <ol className={styles.printChoices} type="A">
                          {(question.options || [])
                            .filter((option) => String(option || "").trim())
                            .map((option, optionIndex) => (
                              <li key={optionIndex}>{option}</li>
                            ))}
                        </ol>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            ))
          ) : (
            <p>No questions have been added yet.</p>
          )}
        </section>
      )}
    </div>
  );
}
