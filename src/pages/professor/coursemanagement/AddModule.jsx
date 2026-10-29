import { removeLessonPracticeActivities } from "../../../services/lessonPracticeContent.js";
import { generateModulePractice } from "../../../services/modulePracticeGeneration.js";
import ProfessorCatalogSelection from "../../../components/catalog/ProfessorCatalogSelection.jsx";
import ManagementBackBar from "../../../components/ManagementBackBar.jsx";
import { selectCourseBuilderDraft } from "../../../services/courseBuilderDraft.js";
import { ensureGenerationCourse } from "../../../services/generationCourseDraft.js";
import QuizSourceEvidence from "../../../components/quizmodes/QuizSourceEvidence.jsx";
import {
  requestQuizSettings,
  quizSourceFields,
  quizGenerationFields,
  notifyQuizGenerated,
} from "../../../services/quizGenerationUi.js";
import { notifyLessonGenerated } from "../../../services/lessonNotifications.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { lessonAuthHeaders } from "../../../services/lessonAuth.js";
import { uploadLessonSource } from "../../../services/lessonRagApi.js";
import LessonSourceEvidence from "../../../components/lesson/LessonSourceEvidence.jsx";
import LessonSourceManager from "../../../components/lesson/LessonSourceManager.jsx";
import LessonFilePicker from "../../../components/lesson/LessonFilePicker.jsx";
import Swal from "sweetalert2";

import { useAuth } from "../../../context/AuthContext.jsx";
import { API_BASE } from "../../../config.js";
import { fetchCourse, saveCourse } from "../../../services/courseApi.js";

import styles from "./Addmodule.module.css";

const TITLE_LIMIT = 100;
const CODE_LIMIT = 24;
const LONG_LIMIT = 750;
const LESSON_LIMIT = 6000;
const QUIZ_LIMIT = 500;

function createId(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createCourseCode() {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-5);

  const randomPart = Math.random()
    .toString(36)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4)
    .padEnd(4, "0");

  return `PB-${timestamp}-${randomPart}`;
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
    explanation: "",
  };
}

function createEmptyContentModule(index = 0) {
  return {
    id: createId("module"),
    title: `Module ${index + 1}`,
    description: "",
    learningObjectives: "",
    lessonPages: [],
    quizItems: [],
    mainQuizSettings: {
      enabled: false,
      unlockAt: "",
      lockAt: "",
    },
    mainQuizEnabled: false,
    mainQuizUnlockAt: "",
  };
}

const emptyCourse = {
  title: "",
  code: "",
  summary: "",
  subject: "",
  status: "draft",
  visibility: "private",
  contentModules: [],
  students: 0,
};

function createEmptyCourseDraft() {
  return {
    ...emptyCourse,
    code: createCourseCode(),
    contentModules: [],
  };
}
const COURSE_DRAFT_STORAGE_PREFIX = "puffy-course-builder-draft";

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
    // Navigation state still carries the draft if session storage is unavailable.
  }
}

function clearCourseBuilderDraft(courseId) {
  try {
    sessionStorage.removeItem(getCourseDraftStorageKey(courseId));
  } catch {
    // Nothing to clear.
  }
}

function limit(value, max) {
  return String(value || "").slice(0, max);
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

function counterClass(current, max) {
  return current >= max
    ? `${styles.wordCounter} ${styles.wordCounterFull}`
    : styles.wordCounter;
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
    options,
    correct_answer: String(item?.correct_answer || item?.answer || ""),
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
  };
}

function normalizeContentModule(module, index) {
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
    catalogCoverageTitle: module?.catalogCoverageTitle || "",
    topics: Array.isArray(module?.topics) ? module.topics : [],

    description: String(module?.description || module?.summary || ""),

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

    mainQuizSettings,
    mainQuizEnabled: mainQuizSettings.enabled,
    main_quiz_enabled: mainQuizSettings.enabled,
    mainQuizUnlockAt: mainQuizSettings.unlockAt,
    main_quiz_unlock_at: mainQuizSettings.unlockAt,
    mainQuizLockAt: mainQuizSettings.lockAt,
    main_quiz_lock_at: mainQuizSettings.lockAt,
  };
}

function getModuleKeyFromItem(item, fallbackIndex) {
  const moduleIndex = Number(item?.moduleIndex ?? item?.module_index);

  if (Number.isInteger(moduleIndex)) {
    return `index-${moduleIndex}`;
  }

  const moduleId = item?.moduleId || item?.module_id;

  if (moduleId) {
    return `id-${moduleId}`;
  }

  const moduleTitle = String(
    item?.moduleTitle || item?.module_title || "",
  ).trim();

  if (moduleTitle) {
    return `title-${moduleTitle.toLowerCase()}`;
  }

  return "legacy-module";
}

function rebuildModulesFromFlatContent(course) {
  const lessonPages = readList(
    course?.lessonPages,
    course?.lesson_pages,
    course?.lessonContent,
    course?.lesson_content,
  );

  const quizItems = readList(
    course?.quizItems,
    course?.quiz_items,
    course?.quizModule,
    course?.quiz_contents,
  );

  const modules = new Map();

  const ensureModule = (item, fallbackIndex = 0) => {
    const key = getModuleKeyFromItem(item, fallbackIndex);

    if (!key) {
      return null;
    }

    if (!modules.has(key)) {
      const moduleIndex = Number(item?.moduleIndex ?? item?.module_index);

      modules.set(key, {
        id: item?.moduleId || item?.module_id || createId("module"),

        order: Number.isInteger(moduleIndex) ? moduleIndex : modules.size,

        title:
          String(item?.moduleTitle || item?.module_title || "").trim() ||
          `Module ${modules.size + 1}`,

        description: String(
          item?.moduleDescription ||
            item?.module_description ||
            course?.summary ||
            "",
        ),

        learningObjectives: String(
          item?.moduleLearningObjectives ||
            item?.module_learning_objectives ||
            course?.learningObjectives ||
            course?.learning_objectives ||
            "",
        ),

        lessonPages: [],
        quizItems: [],
      });
    }

    return modules.get(key);
  };

  lessonPages.forEach((page, index) => {
    const module = ensureModule(page, index);

    if (module) {
      module.lessonPages.push(normalizeLessonPage(page));
    }
  });

  quizItems.forEach((item, index) => {
    const module = ensureModule(item, index);

    if (module) {
      module.quizItems.push(normalizeQuizItem(item));
    }
  });

  return [...modules.values()]
    .sort((left, right) => left.order - right.order)
    .map(({ order, ...module }, index) =>
      normalizeContentModule(module, index),
    );
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
          : null;

  let contentModules = [];

  if (nestedModules?.length) {
    contentModules = nestedModules.map(normalizeContentModule);
  } else {
    contentModules = rebuildModulesFromFlatContent(course);

    if (contentModules.length) {
      return {
        ...emptyCourse,
        ...course,

        code: String(
          course?.code || course?.courseCode || course?.course_code || "",
        ),

        summary: String(course?.summary || ""),

        subject: String(course?.subject || ""),

        status: course?.status === "published" ? "published" : "draft",

        visibility: course?.visibility === "public" ? "public" : "private",

        contentModules,
      };
    }

    const oldLessonPages = Array.isArray(course?.lessonPages)
      ? course.lessonPages
      : [];

    const oldQuizItems = Array.isArray(course?.quizItems)
      ? course.quizItems
      : [];

    if (
      oldLessonPages.length ||
      oldQuizItems.length ||
      course?.learningObjectives
    ) {
      contentModules = [
        normalizeContentModule(
          {
            title: "Module 1",
            description: course?.summary || "",
            learningObjectives: course?.learningObjectives || "",
            lessonPages: oldLessonPages,
            quizItems: oldQuizItems,
          },
          0,
        ),
      ];
    }
  }

  return {
    ...emptyCourse,
    ...course,

    code: String(
      course?.code || course?.courseCode || course?.course_code || "",
    ),

    summary: String(course?.summary || ""),

    subject: String(course?.subject || ""),

    status: course?.status === "published" ? "published" : "draft",

    visibility: course?.visibility === "public" ? "public" : "private",

    contentModules,
  };
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("puffy-user") || "null");
  } catch {
    return null;
  }
}

export default function AddModule() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isEditing = Boolean(id);
  const generationCourseRef = useRef(null);
  const courseSaveInFlight = useRef(false);

  const [form, setForm] = useState(() => {
    const draft = selectCourseBuilderDraft(
      id,
      location.state?.courseDraft,
      readCourseBuilderDraft,
    );

    if (draft) {
      return normalizeCourse(draft);
    }

    return isEditing ? emptyCourse : createEmptyCourseDraft();
  });

  const [loading, setLoading] = useState(isEditing);

  const [isSaving, setIsSaving] = useState(false);

  const [processingModuleId, setProcessingModuleId] = useState(null);

  const [generatingQuizModuleId, setGeneratingQuizModuleId] = useState(null);

  const [expandedModuleId, setExpandedModuleId] = useState(null);

  const [moduleFiles, setModuleFiles] = useState({});

  const [activePageIndexes, setActivePageIndexes] = useState({});

  useEffect(() => {
    if (isEditing) {
      return;
    }

    generationCourseRef.current = null;
    if (!location.state?.courseDraft) clearCourseBuilderDraft(undefined);

    const draft = selectCourseBuilderDraft(
      id,
      location.state?.courseDraft,
      readCourseBuilderDraft,
    );

    setForm(draft ? normalizeCourse(draft) : createEmptyCourseDraft());
    setExpandedModuleId(null);
    setModuleFiles(location.state?.moduleFiles || {});
    setActivePageIndexes({});
    setLoading(false);
  }, [id, isEditing, location.key, location.state]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const draft = selectCourseBuilderDraft(
      id,
      location.state?.courseDraft,
      readCourseBuilderDraft,
    );

    if (draft) {
      const normalized = normalizeCourse(draft);

      setForm(normalized);
      setExpandedModuleId(null);
      setModuleFiles({});
      setActivePageIndexes({});
      setLoading(false);

      return;
    }

    let active = true;

    async function loadCourse() {
      try {
        setLoading(true);

        const selected = await fetchCourse(id);

        if (active && selected) {
          const normalized = normalizeCourse(selected);

          setForm(normalized);

          setExpandedModuleId(null);
        }
      } catch (error) {
        await Swal.fire({
          icon: "error",
          title: "Unable to Load Course",
          text: error.message || "Could not load course.",
          confirmButtonText: "OK",
        });

        navigate("/professor/courses");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadCourse();

    return () => {
      active = false;
    };
  }, [id, isEditing, navigate]);

  const moduleCount = form.contentModules.length;

  const totalLessonPages = useMemo(
    () =>
      form.contentModules.reduce(
        (total, module) => total + module.lessonPages.length,
        0,
      ),
    [form.contentModules],
  );

  const totalQuizItems = useMemo(
    () =>
      form.contentModules.reduce(
        (total, module) =>
          total +
          module.quizItems.filter((item) => item.question.trim()).length,
        0,
      ),
    [form.contentModules],
  );

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateCourseCode = (value) => {
    updateField(
      "code",
      String(value || "")
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, "")
        .slice(0, CODE_LIMIT),
    );
  };

  const getModuleEditorPath = (moduleId) =>
    isEditing || (Number.isSafeInteger(Number(form.id)) && Number(form.id) > 0)
      ? `/professor/courses/edit/${id || form.id}/modules/${encodeURIComponent(moduleId)}/edit`
      : `/professor/courses/new/modules/${encodeURIComponent(moduleId)}/edit`;

  const openModuleEditor = (moduleId, draft = form) => {
    writeCourseBuilderDraft(id, draft);

    navigate(getModuleEditorPath(moduleId), {
      state: {
        courseDraft: draft,
      },
    });
  };

  const addContentModule = () => {
    const module = createEmptyContentModule(form.contentModules.length);

    const nextForm = {
      ...form,
      contentModules: [...form.contentModules, module],
    };

    setForm(nextForm);
    setExpandedModuleId(null);

    setActivePageIndexes((current) => ({
      ...current,
      [module.id]: 0,
    }));

    openModuleEditor(module.id, nextForm);
  };
  const updateContentModule = (moduleId, field, value) => {
    setForm((current) => ({
      ...current,

      contentModules: current.contentModules.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              [field]: value,
            }
          : module,
      ),
    }));
  };

  const removeContentModule = async (moduleId) => {
    const selectedModule = form.contentModules.find(
      (module) => module.id === moduleId,
    );

    const result = await Swal.fire({
      icon: "warning",
      title: "Remove Module?",
      text: `This will remove ${
        selectedModule?.title || "this module"
      }, including its lesson pages and quiz items.`,
      showCancelButton: true,
      confirmButtonText: "Remove Module",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) {
      return;
    }

    setForm((current) => ({
      ...current,

      contentModules: current.contentModules.filter(
        (module) => module.id !== moduleId,
      ),
    }));

    setModuleFiles((current) => {
      const next = {
        ...current,
      };

      delete next[moduleId];

      return next;
    });

    setActivePageIndexes((current) => {
      const next = {
        ...current,
      };

      delete next[moduleId];

      return next;
    });

    if (expandedModuleId === moduleId) {
      const remaining = form.contentModules.filter(
        (module) => module.id !== moduleId,
      );

      setExpandedModuleId(remaining[0]?.id || null);
    }
  };

  const addLessonPage = (moduleId) => {
    const page = createEmptyLessonPage();

    setForm((current) => ({
      ...current,

      contentModules: current.contentModules.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              lessonPages: [...module.lessonPages, page],
            }
          : module,
      ),
    }));

    const selectedModule = form.contentModules.find(
      (module) => module.id === moduleId,
    );

    setActivePageIndexes((current) => ({
      ...current,

      [moduleId]: selectedModule?.lessonPages.length || 0,
    }));
  };

  const updateLessonPage = (moduleId, pageIndex, field, value) => {
    setForm((current) => ({
      ...current,

      contentModules: current.contentModules.map((module) =>
        module.id !== moduleId
          ? module
          : {
              ...module,

              lessonPages: module.lessonPages.map((page, currentPageIndex) =>
                currentPageIndex === pageIndex
                  ? {
                      ...page,
                      [field]: value,
                      ...(field === "content"
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
            },
      ),
    }));
  };

  const removeLessonPage = (moduleId, pageIndex) => {
    setForm((current) => ({
      ...current,

      contentModules: current.contentModules.map((module) => {
        if (module.id !== moduleId) {
          return module;
        }

        return {
          ...module,

          lessonPages: module.lessonPages.filter(
            (_, currentPageIndex) => currentPageIndex !== pageIndex,
          ),
        };
      }),
    }));

    setActivePageIndexes((current) => {
      const selectedModule = form.contentModules.find(
        (module) => module.id === moduleId,
      );

      const nextLength = Math.max(
        0,
        (selectedModule?.lessonPages.length || 1) - 1,
      );

      return {
        ...current,

        [moduleId]:
          nextLength === 0
            ? 0
            : Math.min(current[moduleId] || 0, nextLength - 1),
      };
    });
  };

  const addQuizItem = (moduleId) => {
    setForm((current) => ({
      ...current,

      contentModules: current.contentModules.map((module) =>
        module.id === moduleId
          ? {
              ...module,

              quizItems: [...module.quizItems, createEmptyQuizItem()],
            }
          : module,
      ),
    }));
  };

  const updateQuizItem = (moduleId, quizIndex, field, value) => {
    setForm((current) => ({
      ...current,

      contentModules: current.contentModules.map((module) =>
        module.id !== moduleId
          ? module
          : {
              ...module,

              quizItems: module.quizItems.map((item, currentQuizIndex) =>
                currentQuizIndex === quizIndex
                  ? {
                      ...item,
                      [field]: value,
                    }
                  : item,
              ),
            },
      ),
    }));
  };

  const updateQuizOption = (moduleId, quizIndex, optionIndex, value) => {
    setForm((current) => ({
      ...current,

      contentModules: current.contentModules.map((module) => {
        if (module.id !== moduleId) {
          return module;
        }

        return {
          ...module,

          quizItems: module.quizItems.map((item, currentQuizIndex) => {
            if (currentQuizIndex !== quizIndex) {
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
        };
      }),
    }));
  };

  const removeQuizItem = (moduleId, quizIndex) => {
    setForm((current) => ({
      ...current,

      contentModules: current.contentModules.map((module) =>
        module.id !== moduleId
          ? module
          : {
              ...module,

              quizItems: module.quizItems.filter(
                (_, currentQuizIndex) => currentQuizIndex !== quizIndex,
              ),
            },
      ),
    }));
  };

  const uploadAndAutoSort = async (moduleId) => {
    const uploadedFile = moduleFiles[moduleId] || [];

    if (!uploadedFile.length) {
      await Swal.fire({
        icon: "warning",
        title: "No File Selected",
        text: "Please choose PDF, PPT, PPTX, DOCX, or TXT lesson files first.",
        confirmButtonText: "OK",
      });

      return;
    }

    const selectedModule = form.contentModules.find(
      (module) => module.id === moduleId,
    );

    try {
      setProcessingModuleId(moduleId);
      const generationCourse = await ensureGenerationCourse(
        form,
        id,
        generationCourseRef,
        saveCourse,
      );
      if (String(generationCourse.id) !== String(id)) {
        setForm(generationCourse);
        writeCourseBuilderDraft(id, generationCourse);
        writeCourseBuilderDraft(generationCourse.id, generationCourse);
      }
      const formData = new FormData();
      formData.append("course_id", generationCourse.id);
      formData.append("client_module_key", moduleId);
      formData.append("generation_context", JSON.stringify({
        module_title: selectedModule.title,
        topics: selectedModule.topics || [],
        learning_objectives: selectedModule.learningObjectives,
        instructions: selectedModule.description,
      }));
      if (Number.isInteger(Number(moduleId)) && Number(moduleId) > 0)
        formData.append("lesson_id", moduleId);
      uploadedFile.forEach((file) => formData.append("files", file));

      const data = await uploadLessonSource(formData, (job) => {
        if (Swal.isVisible())
          Swal.update({
            text: `Organizing lesson: ${job.progress}% (${job.phase})`,
          });
      });

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

      const practice = await generateModulePractice({
        courseId: generationCourse.id, moduleId,
        title: selectedModule.title || data.module_title,
        objectives: selectedModule.learningObjectives || data.learning_objectives,
        pages: generatedPages, existing: selectedModule.quizItems || [],
      });
      const nextCourse = {
        ...generationCourse,
        subject: limit(data.subject || generationCourse.subject, TITLE_LIMIT),
        contentModules: generationCourse.contentModules.map((module) =>
          module.id !== moduleId
            ? module
            : {
                ...module,
                title: limit(module.title || data.module_title, TITLE_LIMIT),
                description: limit(
                  data.description || module.description,
                  LONG_LIMIT,
                ),
                learningObjectives: limit(
                  module.learningObjectives || data.learning_objectives,
                  LONG_LIMIT,
                ),
                studentPublished: false,
                lessonPages: generatedPages,
                quizItems: practice.questions.map(normalizeQuizItem),
              },
        ),
      };
      setForm(nextCourse);
      writeCourseBuilderDraft(generationCourse.id, nextCourse);
      if (String(generationCourse.id) !== String(id))
        navigate(`/professor/courses/edit/${generationCourse.id}`, {
          replace: true,
          state: { courseDraft: nextCourse, moduleFiles },
        });

      setActivePageIndexes((current) => ({
        ...current,
        [moduleId]: 0,
      }));

      await notifyLessonGenerated(generatedPages);
      if (practice.error) {
        await Swal.fire({icon: "warning", title: "Lessons ready; Practice Quiz needs a retry", text: `${practice.error} Your generated lessons are preserved. Open Practice Quiz and choose Auto Generate to retry.`});
      } else if (!practice.keptExisting) {
        notifyQuizGenerated(practice.questions.length);
      }
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "Processing Failed",
        text: error.message || "Could not process the lesson file.",
        confirmButtonText: "OK",
      });
    } finally {
      setProcessingModuleId(null);
    }
  };

  const autoGenerateQuiz = async (moduleId) => {
    const selectedModule = form.contentModules.find(
      (module) => module.id === moduleId,
    );

    if (!selectedModule) {
      return;
    }

    const lessonContent = selectedModule.lessonPages
      .map((page) =>
        [page.title ? `Lesson page: ${page.title}` : "", page.content]
          .filter(Boolean)
          .join("\n"),
      )
      .filter(Boolean)
      .join("\n\n");

    if (!lessonContent && !selectedModule.learningObjectives.trim()) {
      await Swal.fire({
        icon: "warning",
        title: "Module Content Required",
        text: "Add learning objectives or lesson pages to this module first.",
        confirmButtonText: "OK",
      });

      return;
    }

    const result = await requestQuizSettings();

    if (!result.isConfirmed || !result.value) {
      return;
    }

    try {
      setGeneratingQuizModuleId(moduleId);

      Swal.fire({
        title: "Generating Quiz",
        text: "Retrieving source passages and checking the questions and answers.",
        allowOutsideClick: false,
        allowEscapeKey: false,

        didOpen: () => {
          Swal.showLoading();
        },
      });

      const response = await fetch(`${API_BASE}/lessons/generate-quiz`, {
        method: "POST",
        credentials: "include",

        headers: {
          "Content-Type": "application/json",
          ...lessonAuthHeaders(),
        },

        body: JSON.stringify({
          ...quizSourceFields(
            id || form.id,
            selectedModule.id,
            selectedModule.lessonPages,
          ),
          lesson_title: selectedModule.title,

          lesson_content: lessonContent,

          learning_objectives: selectedModule.learningObjectives,

          ...quizGenerationFields(result.value, {
            lessonTitle: selectedModule.title,
            learningObjectives: selectedModule.learningObjectives,
            lessonContent,
          }),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not generate the quiz.");
      }

      const generatedQuestions = Array.isArray(data.quiz?.questions)
        ? data.quiz.questions
            .map(normalizeQuizItem)
            .filter((item) => item.question)
        : [];

      if (generatedQuestions.length === 0) {
        throw new Error("No valid quiz questions were generated.");
      }

      updateContentModule(moduleId, "quizItems", generatedQuestions);

      notifyQuizGenerated(generatedQuestions.length);
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "Quiz Generation Failed",
        text: error.message || "Could not generate the quiz.",
        confirmButtonText: "OK",
      });
    } finally {
      setGeneratingQuizModuleId(null);
    }
  };

  const uploadModuleToStudents = async (moduleId) => {
    if (courseSaveInFlight.current) return;
    const target = form.contentModules.find(
      (module) => String(module.id) === String(moduleId),
    );
    if (!target) return;
    const publishing = target.studentPublished !== true;
    if (!publishing) {
      const confirmation = await Swal.fire({
        icon: "question",
        title: "Remove module from students?",
        text: "Students will no longer have access to this module's lessons and quizzes. Your content stays saved and can be uploaded again later.",
        showCancelButton: true,
        confirmButtonText: "Remove from Students",
        cancelButtonText: "Keep uploaded",
        confirmButtonColor: "#7fa8d6",
        focusCancel: true,
      });
      if (!confirmation.isConfirmed || courseSaveInFlight.current) return;
    }
    if (!form.title.trim() || !form.summary.trim()) {
      await Swal.fire({
        icon: "info",
        title: "Complete course details",
        text: "Add the course title and description before uploading a module.",
      });
      return;
    }
    courseSaveInFlight.current = true;
    setIsSaving(true);
    try {
      const persisted = await ensureGenerationCourse(
        form,
        id,
        generationCourseRef,
        saveCourse,
      );
      setForm((current) => ({
        ...current,
        id: persisted.id,
        code: persisted.code || current.code,
      }));
      const contentModules = form.contentModules.map((module) => ({
        ...module,
        studentPublished:
          String(module.id) === String(moduleId)
            ? publishing
            : module.studentPublished === true,
      }));
      const updated = {
        ...form,
        id: persisted.id,
        code: persisted.code || form.code,
        status: "published",
        visibility: "public",
        contentModules,
      };
      const saved = await saveCourse(updated, { fallback: false });
      const next = {
        ...updated,
        id: saved?.id || saved?.course_id || persisted.id,
      };
      setForm(next);
      writeCourseBuilderDraft(id, next);
      writeCourseBuilderDraft(next.id, next);
      await Swal.fire({
        icon: "success",
        title: publishing ? "Module uploaded" : "Module removed from students",
        text: publishing
          ? "This module is available to enrolled students. Other modules keep their upload status."
          : "Student access is off for this module. Its lessons and quizzes are still saved.",
      });
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "Upload failed",
        text: error.message || "Please try again.",
      });
    } finally {
      courseSaveInFlight.current = false;
      setIsSaving(false);
    }
  };

  const saveCourseForm = async (event) => {
    event.preventDefault();

    if (isSaving || courseSaveInFlight.current) {
      return;
    }

    if (!isEditing && !Number(form.id) && !form.catalogId) {
      await Swal.fire({
        icon: "warning",
        title: "Select a course",
        text: "Select an active course from the Course Catalog.",
      });
      return;
    }

    if (!form.title.trim()) {
      await Swal.fire({
        icon: "warning",
        title: "Required Fields Missing",
        text: "Course title is required to save a draft.",
        confirmButtonText: "OK",
      });

      return;
    }

    const missingDetails = [];
    const missingPracticeQuizzes = [];
    if (!form.summary.trim())
      missingDetails.push("Course description is missing.");
    if (!form.contentModules.length)
      missingDetails.push("Add at least one course module.");
    form.contentModules.forEach((module, index) => {
      const label = `Module ${index + 1}${module.title.trim() ? ` (${module.title.trim()})` : ""}`;
      if (!module.title.trim())
        missingDetails.push(`${label}: module title is missing.`);
      if (!module.quizItems.length)
        missingPracticeQuizzes.push(
          `${label}: no Practice Quiz questions yet.`,
        );
    });
    const uploadToStudents = event.nativeEvent?.submitter?.value === "publish";
    const saveAsDraft =
      (!uploadToStudents && form.status !== "published") ||
      missingDetails.length > 0;
    const detailsList = (details) => {
      const list = document.createElement("ul");
      list.style.textAlign = "left";
      details.forEach((detail) => {
        const item = document.createElement("li");
        item.textContent = detail;
        list.appendChild(item);
      });
      return list.outerHTML;
    };

    const normalizedCode = (form.code.trim() || createCourseCode())
      .trim()
      .toUpperCase();
    const courseTitle = form.title.trim();
    const courseSummary = form.summary.trim();
    const courseSubject = form.subject.trim() || courseTitle;
    const learningObjectives = form.contentModules
      .map((module) => module.learningObjectives.trim())
      .filter(Boolean)
      .join("\n\n");

    const storedUser = getStoredUser();

    const currentProfessor = user || storedUser || {};

    const professorName =
      currentProfessor.displayName ||
      currentProfessor.display_name ||
      currentProfessor.name ||
      currentProfessor.email ||
      "Professor";

    const professorEmail = currentProfessor.email || "";

    const professorDepartment =
      currentProfessor.professorDepartment ||
      currentProfessor.professor_department ||
      currentProfessor.department ||
      "";

    const professorProfileImage =
      currentProfessor.profileImage ||
      currentProfessor.profile_image ||
      currentProfessor.avatar ||
      currentProfessor.image ||
      "";

    const professorId =
      currentProfessor.id ||
      currentProfessor.userId ||
      currentProfessor.user_id ||
      null;

    const payload = {
      catalogId: form.catalogId || null,
      syllabusVersionId: form.syllabusVersionId || null,
      className: form.className || "",
      academicYear: form.academicYear || "",
      semester: form.semester || "",
      program: form.program || "",
      yearLevel: form.yearLevel || "",
      sectionName: form.sectionName || "",
      title: courseTitle,
      courseName: courseTitle,
      course_name: courseTitle,

      code: normalizedCode,
      courseCode: normalizedCode,
      course_code: normalizedCode,

      summary: courseSummary,
      description: courseSummary,

      subject: courseSubject,

      status: saveAsDraft ? "draft" : "published",

      contentModules: form.contentModules,

      learningObjectives,

      learning_objectives: learningObjectives,

      visibility: saveAsDraft ? "private" : "public",

      joinLink: `/student/join?courseCode=${encodeURIComponent(
        normalizedCode,
      )}`,

      modules: moduleCount,

      lessonPageCount: totalLessonPages,

      quizzes: totalQuizItems,

      updatedAt: new Date().toISOString().slice(0, 10),

      archived: false,

      professorId,
      professor_id: professorId,

      professorName,
      professor_name: professorName,

      professorEmail,
      professor_email: professorEmail,

      professorDepartment,
      professor_department: professorDepartment,

      professorProfileImage,
      professor_profile_image: professorProfileImage,
    };

    if (courseSaveInFlight.current) return;
    try {
      courseSaveInFlight.current = true;
      setIsSaving(true);

      const savedCourse = await saveCourse(
        isEditing ||
          (Number.isSafeInteger(Number(form.id)) && Number(form.id) > 0)
          ? {
              ...payload,
              id: id || form.id,
            }
          : payload,
        { fallback: false },
      );
      // Retain the server identity before showing dialogs or navigating. A
      // subsequent save must update this draft rather than POST another class.
      const savedId = savedCourse?.id ?? savedCourse?.course_id;
      if (Number.isSafeInteger(Number(savedId)) && Number(savedId) > 0) {
        const persistedDraft = {
          ...form,
          id: Number(savedId),
          code: savedCourse.code || savedCourse.course_code || form.code,
        };
        setForm(persistedDraft);
        writeCourseBuilderDraft(id, persistedDraft);
        writeCourseBuilderDraft(savedId, persistedDraft);
      }

      await Swal.fire({
        icon: "success",

        title: isEditing ? "Course Updated" : "Course Added",

        customClass: {
          popup: styles.courseSavePopup,
          title: styles.courseSaveTitle,
          htmlContainer: styles.courseSaveDetails,
          confirmButton: styles.courseSaveConfirm,
        },

        html:
          (saveAsDraft
            ? `<p>Saved as a draft. Students cannot access it until it is published.</p>${form.status !== "published" ? "<p>Status is set to Draft.</p>" : ""}${missingDetails.length ? `<section><h3>Required before publishing</h3>${detailsList(missingDetails)}</section>` : "<p>The required details are complete. Select Publish to make the course available.</p>"}`
            : "<p>The course is available to students. Empty modules can be completed later. Save this published course after adding lessons to make them available to students.</p>") +
          (missingPracticeQuizzes.length
            ? `<section><h3>Practice Quiz <small>Optional</small></h3>${detailsList(missingPracticeQuizzes)}<p>Practice Quizzes do not prevent publishing.</p></section>`
            : ""),

        confirmButtonText: "Done",
      });

      clearCourseBuilderDraft(id);

      navigate("/professor/courses");
    } catch (error) {
      if (!isEditing && /already created this catalog course/i.test(error.message || "")) {
        await Swal.fire({ title: "Course already exists", customClass: { container: "catalog-duplicate-overlay", popup: "catalog-duplicate-dialog" }, text: error.message, imageUrl: "/images/reminder.png", imageWidth: 300, confirmButtonText: "Back to Course Management" });
        navigate("/professor/courses");
        return;
      }
      await Swal.fire({
        icon: "error",

        title: isEditing ? "Update Failed" : "Save Failed",

        text: error.message || "Could not save course.",

        confirmButtonText: "OK",
      });
    } finally {
      courseSaveInFlight.current = false;
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <section
        className={`${styles.addModulePage} ${styles.courseBuilderPage} course-builder-page ${
          isEditing ? "edit-course-page" : ""
        }`}
      >
        <div className={styles.pageHeader}>
          <h1>Loading Course...</h1>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`${styles.addModulePage} ${styles.courseBuilderPage} course-builder-page ${
        isEditing ? "edit-course-page" : ""
      }`}
    >
      <ManagementBackBar
        onClick={() => {
          writeCourseBuilderDraft(id, form);
          navigate("/professor/courses");
        }}
      >
        Back to courses
      </ManagementBackBar>
      <div className={styles.pageHeader}>
        <div>
          <h1>{isEditing ? "Edit Course" : "Add Course"}</h1>

          <p className={styles.pageHeaderText}>
            Build the course using modules. Each module can contain lesson pages
            and its own quiz.
          </p>
        </div>
      </div>

      <form className={styles.formCard} onSubmit={saveCourseForm}>
        <div className={styles.popupInfoGrid}>
          <div className={styles.courseIdentityColumn}>
            <ProfessorCatalogSelection
              form={form}
              onChange={setForm}
              isEditing={isEditing}
            />

            <div className={styles.popupField}>
              <label className={styles.popupLabel}>
                Course Title
                <span className={styles.required}>*Required</span>
              </label>

              <input
                className={styles.popupInput}
                value={form.title}
                readOnly={!!form.catalogId || !isEditing}
                onChange={(event) =>
                  updateField("title", limit(event.target.value, TITLE_LIMIT))
                }
                placeholder="Enter course title"
              />

              <div className={counterClass(form.title.length, TITLE_LIMIT)}>
                {form.title.length}/{TITLE_LIMIT} characters
              </div>
            </div>
          </div>
          <div className={styles.courseClassColumn}>
            <div className={styles.popupField}>
              <label className={styles.popupLabel}>
                Class Join Code
                <span className={styles.required}>*Required</span>
              </label>

              <input
                className={styles.popupInput}
                value={form.code}
                readOnly
                aria-readonly="true"
                placeholder="Auto-generated course code"
              />

              <p className={styles.courseCodeNote}>
                Auto-generated course code. It cannot be changed.
              </p>

              <div className={counterClass(form.code.length, CODE_LIMIT)}>
                {form.code.length}/{CODE_LIMIT} characters
              </div>
            </div>

            <div className={`${styles.popupField} ${styles.courseStatusField}`}>
              <label className={styles.popupLabel}>Status</label>

              <select
                className={styles.popupSelect}
                value={form.status}
                onChange={(event) => updateField("status", event.target.value)}
              >
                <option value="draft">Draft</option>

                <option value="published">Published</option>
              </select>
            </div>
          </div>
        </div>

        <div className={styles.popupSection}>
          <label className={styles.popupLabel}>
            Course Description
            <span className={styles.required}>*Required</span>
          </label>

          <textarea
            className={`${styles.popupTextarea} ${styles.popupSmallBox}`}
            value={form.summary}
            onChange={(event) =>
              updateField("summary", limit(event.target.value, LONG_LIMIT))
            }
            placeholder="Enter course description"
          />

          <div className={counterClass(form.summary.length, LONG_LIMIT)}>
            {form.summary.length}/{LONG_LIMIT} characters
          </div>
        </div>

        <div className={styles.popupSection}>
          <label className={styles.popupLabel}>
            Subject
            <span className={styles.required}>*Required</span>
          </label>

          <input
            className={styles.popupInput}
            value={form.subject}
            onChange={(event) =>
              updateField("subject", limit(event.target.value, TITLE_LIMIT))
            }
            placeholder="Enter subject"
          />

          <div className={counterClass(form.subject.length, TITLE_LIMIT)}>
            {form.subject.length}/{TITLE_LIMIT} characters
          </div>
        </div>

        <section className={styles.moduleBuilderSection}>
          <div className={styles.moduleBuilderHeader}>
            <div>
              <h2>Course Modules</h2>

              <p>Add your modules below:</p>
            </div>

            <button
              className={styles.popupAddBtn}
              type="button"
              onClick={addContentModule}
            >
              + Add Module
            </button>
          </div>

          {form.contentModules.length === 0 ? (
            <div className={styles.popupEmptyQuiz}>
              No modules yet. Add your first module to begin.
            </div>
          ) : (
            <div className={styles.moduleCardGrid}>
              {form.contentModules.map((module, moduleIndex) => {
                const isExpanded = expandedModuleId === module.id;

                const activePageIndex = activePageIndexes[module.id] || 0;

                const activePage = module.lessonPages[activePageIndex] || null;

                const isProcessing = processingModuleId === module.id;

                const isGenerating = generatingQuizModuleId === module.id;

                return (
                  <article
                    className={`${styles.moduleCard} ${
                      isExpanded ? styles.moduleCardExpanded : ""
                    }`}
                    key={module.id}
                  >
                    <div className={styles.moduleCardHeader}>
                      <div className={styles.moduleNumber}>
                        {moduleIndex + 1}
                      </div>

                      <div className={styles.moduleCardHeading}>
                        <span>Module {moduleIndex + 1}</span>

                        <h3>{module.title || `Module ${moduleIndex + 1}`}</h3>

                        <p>
                          {module.lessonPages.length} lesson page(s) &middot;{" "}
                          {module.quizItems.length} quiz item(s)
                        </p>
                      </div>

                      <div className={styles.moduleCardHeaderActions}>
                        <button
                          type="button"
                          className={`${styles.moduleUploadBtn} ${module.studentPublished === true ? styles.moduleUploaded : styles.moduleNotUploaded}`}
                          aria-pressed={module.studentPublished === true}
                          title={module.studentPublished === true ? "Click to turn student access off" : "Click to upload to students"}
                          disabled={
                            isSaving ||
                            Boolean(processingModuleId) ||
                            Boolean(generatingQuizModuleId)
                          }
                          onClick={() => uploadModuleToStudents(module.id)}
                        >
                          {module.studentPublished === true
                            ? "Uploaded - Turn Off"
                            : "Upload to Students"}
                        </button>

                        <button
                          type="button"
                          className={styles.moduleExpandBtn}
                          onClick={() => openModuleEditor(module.id)}
                        >
                          Edit Module
                        </button>

                        <button
                          type="button"
                          className={styles.moduleDeleteBtn}
                          onClick={() => removeContentModule(module.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className={styles.moduleCardBody}>
                        <div className={styles.moduleInfoGrid}>
                          <div className={styles.popupField}>
                            <label className={styles.popupLabel}>
                              Module Title
                            </label>

                            <input
                              className={styles.popupInput}
                              value={module.title}
                              onChange={(event) =>
                                updateContentModule(
                                  module.id,
                                  "title",
                                  limit(event.target.value, TITLE_LIMIT),
                                )
                              }
                              placeholder="Enter module title"
                            />
                          </div>

                          <div className={styles.popupField}>
                            <label className={styles.popupLabel}>
                              Module Description
                            </label>

                            <textarea
                              className={`${styles.popupTextarea} ${styles.popupSmallBox}`}
                              value={module.description}
                              onChange={(event) =>
                                updateContentModule(
                                  module.id,
                                  "description",
                                  limit(event.target.value, LONG_LIMIT),
                                )
                              }
                              placeholder="Enter module description"
                            />
                          </div>
                        </div>

                        <div className={styles.popupSection}>
                          <label className={styles.popupLabel}>Suggested topics (one per line)</label>
                          <textarea className={styles.popupTextarea} value={(module.topics || []).join("\n")}
                            onChange={event => updateContentModule(module.id, "topics", event.target.value.split("\n"))}
                            placeholder="Review, remove, or add topics before generating lessons" />
                          <p>The syllabus guides coverage. Upload learning materials below for detailed references. Review generated lessons before publishing.</p>
                        </div>
                        <div className={styles.popupSection}>
                          <label className={styles.popupLabel}>
                            Learning Objectives
                            <span className={styles.required}>*Required</span>
                          </label>

                          <textarea
                            className={`${styles.popupTextarea} ${styles.popupSmallBox}`}
                            value={module.learningObjectives}
                            onChange={(event) =>
                              updateContentModule(
                                module.id,
                                "learningObjectives",
                                limit(event.target.value, LONG_LIMIT),
                              )
                            }
                            placeholder="Enter module learning objectives"
                          />
                        </div>

                        <div className={styles.popupSection}>
                          <label className={styles.popupLabel}>
                            Generate Lessons from Reference Materials
                          </label>

                          <div className={styles.uploadRow}>
                            <LessonFilePicker
                              files={moduleFiles[module.id] || []}
                              disabled={isProcessing}
                              buttonClassName={styles.customFileBtn}
                              onChange={(files) =>
                                setModuleFiles((current) => ({
                                  ...current,
                                  [module.id]: files,
                                }))
                              }
                            />

                            <button
                              className={styles.popupAddBtn}
                              type="button"
                              onClick={() => uploadAndAutoSort(module.id)}
                              disabled={
                                isProcessing || !moduleFiles[module.id]?.length
                              }
                            >
                              {isProcessing
                                ? "Generating..."
                                : module.lessonPages.length ? "Regenerate Lessons" : "Generate Lessons"}
                            </button>
                          </div>
                          <LessonSourceManager
                            courseId={id}
                            jobScope={module.id}
                            generationContext={{ module_title: module.title, topics: module.topics || [], learning_objectives: module.learningObjectives, instructions: module.description }}
                            lessonId={
                              Number.isInteger(Number(module.id)) &&
                              Number(module.id) > 0
                                ? Number(module.id)
                                : null
                            }
                            onGenerated={(result) =>
                              setForm((current) => ({
                                ...current,
                                contentModules: current.contentModules.map(
                                  (item) =>
                                    item.id !== module.id
                                      ? item
                                      : {
                                          ...item,
                                          studentPublished: false,
                                          title: item.title || result.module_title,
                                          description: result.description,
                                          learningObjectives:
                                            item.learningObjectives || result.learning_objectives,
                                          lessonPages: result.lesson_pages.map(
                                            (page) => ({
                                              ...page,
                                              id: createId("page"),
                                            }),
                                          ),
                                        },
                                ),
                              }))
                            }
                          />
                        </div>

                        <div className={styles.moduleInnerSection}>
                          <div className={styles.popupSectionRow}>
                            <div>
                              <h4>Lesson Pages</h4>

                              <p>Pages belonging only to this module.</p>
                            </div>

                            <button
                              className={styles.popupAddBtn}
                              type="button"
                              onClick={() => addLessonPage(module.id)}
                            >
                              + Add Page
                            </button>
                          </div>

                          {module.lessonPages.length === 0 ? (
                            <div className={styles.popupEmptyQuiz}>
                              No lesson pages in this module.
                            </div>
                          ) : (
                            <>
                              <div className={styles.lessonPageTabs}>
                                {module.lessonPages.map((page, pageIndex) => (
                                  <button
                                    key={page.id}
                                    type="button"
                                    className={`${styles.lessonPageTab} ${
                                      activePageIndex === pageIndex
                                        ? styles.lessonPageTabActive
                                        : ""
                                    }`}
                                    onClick={() =>
                                      setActivePageIndexes((current) => ({
                                        ...current,

                                        [module.id]: pageIndex,
                                      }))
                                    }
                                  >
                                    {pageIndex + 1}
                                  </button>
                                ))}
                              </div>

                              <div className={styles.popupQuizCard}>
                                <div className={styles.popupQuizCardTop}>
                                  <span className={styles.popupQuizCardTitle}>
                                    Page {activePageIndex + 1} of{" "}
                                    {module.lessonPages.length}
                                  </span>

                                  <button
                                    className={styles.popupRemoveBtn}
                                    type="button"
                                    onClick={() =>
                                      removeLessonPage(
                                        module.id,
                                        activePageIndex,
                                      )
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>

                                <input
                                  className={styles.popupInput}
                                  value={activePage?.title || ""}
                                  onChange={(event) =>
                                    updateLessonPage(
                                      module.id,
                                      activePageIndex,
                                      "title",
                                      limit(event.target.value, TITLE_LIMIT),
                                    )
                                  }
                                  placeholder="Page title"
                                />

                                <textarea
                                  className={`${styles.popupTextarea} ${styles.popupLargeBox}`}
                                  value={activePage?.content || ""}
                                  onChange={(event) =>
                                    updateLessonPage(
                                      module.id,
                                      activePageIndex,
                                      "content",
                                      limit(event.target.value, LESSON_LIMIT),
                                    )
                                  }
                                  placeholder="Page content"
                                />
                                <LessonSourceEvidence page={activePage} />

                                <div className={styles.lessonPageNavigation}>
                                  <button
                                    className={styles.lessonNavigationBtn}
                                    type="button"
                                    onClick={() =>
                                      setActivePageIndexes((current) => ({
                                        ...current,

                                        [module.id]: Math.max(
                                          0,
                                          activePageIndex - 1,
                                        ),
                                      }))
                                    }
                                    disabled={activePageIndex === 0}
                                  >
                                    Previous
                                  </button>

                                  <span className={styles.lessonPageIndicator}>
                                    {activePageIndex + 1} /{" "}
                                    {module.lessonPages.length}
                                  </span>

                                  <button
                                    className={styles.lessonNavigationBtn}
                                    type="button"
                                    onClick={() =>
                                      setActivePageIndexes((current) => ({
                                        ...current,

                                        [module.id]: Math.min(
                                          module.lessonPages.length - 1,
                                          activePageIndex + 1,
                                        ),
                                      }))
                                    }
                                    disabled={
                                      activePageIndex ===
                                      module.lessonPages.length - 1
                                    }
                                  >
                                    Next
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        <div className={styles.moduleInnerSection}>
                          <div className={styles.popupSectionRow}>
                            <div>
                              <h4>Module Quiz</h4>

                              <p>Quiz items belonging only to this module.</p>
                            </div>

                            <div className={styles.quizActions}>
                              <button
                                className={styles.popupAddBtn}
                                type="button"
                                onClick={() => autoGenerateQuiz(module.id)}
                                disabled={
                                  isGenerating || isProcessing || isSaving
                                }
                              >
                                {isGenerating
                                  ? "Generating..."
                                  : "Auto Generate"}
                              </button>

                              <button
                                className={styles.popupAddBtn}
                                type="button"
                                onClick={() => addQuizItem(module.id)}
                              >
                                + Add Quiz
                              </button>
                            </div>
                          </div>

                          {module.quizItems.length === 0 ? (
                            <div className={styles.popupEmptyQuiz}>
                              No quiz items in this module.
                            </div>
                          ) : (
                            module.quizItems.map((item, quizIndex) => (
                              <div
                                className={styles.popupQuizCard}
                                key={item.id}
                              >
                                <div className={styles.popupQuizCardTop}>
                                  <span className={styles.popupQuizCardTitle}>
                                    Item {quizIndex + 1}
                                  </span>

                                  <button
                                    className={styles.popupRemoveBtn}
                                    type="button"
                                    onClick={() =>
                                      removeQuizItem(module.id, quizIndex)
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>

                                <select
                                  className={styles.popupSelect}
                                  value={item.type}
                                  onChange={(event) => {
                                    const type = event.target.value;

                                    updateQuizItem(
                                      module.id,
                                      quizIndex,
                                      "type",
                                      type,
                                    );

                                    updateQuizItem(
                                      module.id,
                                      quizIndex,
                                      "options",
                                      type === "identification"
                                        ? []
                                        : ["", "", "", ""],
                                    );

                                    updateQuizItem(
                                      module.id,
                                      quizIndex,
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
                                </select>

                                <input
                                  className={styles.popupInput}
                                  value={item.question}
                                  onChange={(event) =>
                                    updateQuizItem(
                                      module.id,
                                      quizIndex,
                                      "question",
                                      limit(event.target.value, QUIZ_LIMIT),
                                    )
                                  }
                                  placeholder="Question"
                                />

                                <div className={styles.optionsGrid}>
                                  {item.options.map((option, optionIndex) => (
                                    <input
                                      className={styles.popupInput}
                                      key={optionIndex}
                                      value={option}
                                      disabled={item.type === "true_false"}
                                      onChange={(event) =>
                                        updateQuizOption(
                                          module.id,
                                          quizIndex,
                                          optionIndex,
                                          limit(event.target.value, QUIZ_LIMIT),
                                        )
                                      }
                                      placeholder={`Option ${optionIndex + 1}`}
                                    />
                                  ))}
                                </div>

                                {item.type === "identification" ? (
                                  <input
                                    className={styles.popupInput}
                                    value={item.correct_answer}
                                    onChange={(event) =>
                                      updateQuizItem(
                                        module.id,
                                        quizIndex,
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
                                    className={styles.popupSelect}
                                    value={item.correct_answer}
                                    onChange={(event) =>
                                      updateQuizItem(
                                        module.id,
                                        quizIndex,
                                        "correct_answer",
                                        event.target.value,
                                      )
                                    }
                                  >
                                    <option value="">
                                      Select correct answer
                                    </option>

                                    {item.options.map((option, optionIndex) => (
                                      <option
                                        key={optionIndex}
                                        value={option}
                                        disabled={!option.trim()}
                                      >
                                        {option || `Option ${optionIndex + 1}`}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                <QuizSourceEvidence question={item} />

                                <textarea
                                  className={`${styles.popupTextarea} ${styles.popupAnswerBox}`}
                                  value={item.explanation}
                                  onChange={(event) =>
                                    updateQuizItem(
                                      module.id,
                                      quizIndex,
                                      "explanation",
                                      limit(event.target.value, QUIZ_LIMIT),
                                    )
                                  }
                                  placeholder="Explanation"
                                />
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className={styles.popupActions}>
          <button
            className={styles.popupCancelBtn}
            type="button"
            onClick={() => {
              clearCourseBuilderDraft(id);
              navigate("/professor/courses");
            }}
            disabled={
              isSaving ||
              Boolean(processingModuleId) ||
              Boolean(generatingQuizModuleId)
            }
          >
            Cancel
          </button>

          <button
            className={styles.popupSaveBtn}
            type="submit"
            disabled={
              isSaving ||
              Boolean(processingModuleId) ||
              Boolean(generatingQuizModuleId)
            }
          >
            {isSaving ? "Saving..." : "Save Course"}
          </button>
        </div>
      </form>
    </section>
  );
}
