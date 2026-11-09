import { API_BASE } from "../../config.js";
import { lessonAuthHeaders } from "../../services/lessonAuth.js";
import { fetchCourse, fetchCourses } from "../../services/courseApi.js";

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeLessonPage(page, index) {
  if (typeof page === "string") {
    return {
      title: `Lesson Page ${index + 1}`,
      content: page,
    };
  }

  return {
    ...page,
    title: page?.title || page?.heading || `Lesson Page ${index + 1}`,
    content: page?.content || page?.body || page?.lesson || "",
  };
}

function parseLessonPages(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeLessonPage).filter((page) => page.content.trim());
  }

  const text = String(value || "").trim();
  if (!text) return [];

  const parsed = parseJson(text);
  if (Array.isArray(parsed)) {
    return parsed
      .map(normalizeLessonPage)
      .filter((page) => page.content.trim());
  }

  return text
    .split("---")
    .map((content, index) => normalizeLessonPage(content.trim(), index))
    .filter((page) => page.content.trim());
}

function normalizeQuizItem(item, index) {
  return {
    ...item,
    id: item?.id ?? index + 1,
    question: String(item?.question || "").trim(),
    options: Array.isArray(item?.options) ? item.options.filter(Boolean) : [],
    topic: String(item?.topic || item?.category || item?.subject || "").trim(),
    correct_answer: String(
      item?.correct_answer || item?.correctAnswer || item?.answer || "",
    ).trim(),
    answer: String(
      item?.answer || item?.correct_answer || item?.correctAnswer || "",
    ).trim(),
    explanation: String(item?.explanation || "").trim(),
  };
}

function parseQuizItems(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeQuizItem).filter((item) => item.question);
  }

  const text = String(value || "").trim();
  if (!text) return [];

  const parsed = parseJson(text);
  if (!Array.isArray(parsed)) return [];

  return parsed.map(normalizeQuizItem).filter((item) => item.question);
}

export function getCourseLessonPages(content) {
  const candidates = [
    content?.lessonPages,
    content?.lesson_pages,
    content?.lessonContent,
    content?.lesson_content,
    content?.lesson_contents,
  ];

  for (const candidate of candidates) {
    const pages = parseLessonPages(candidate);
    if (pages.length) return pages;
  }

  return [];
}

export function getCourseQuizItems(content) {
  const candidates = [
    content?.quizItems,
    content?.quiz_items,
    content?.quizModule,
    content?.quiz_contents,
    content?.quizContent,
  ];

  for (const candidate of candidates) {
    const items = parseQuizItems(candidate);
    if (items.length) return items;
  }

  return [];
}

function parseModuleList(value) {
  if (Array.isArray(value)) return value;

  const text = String(value || "").trim();
  if (!text) return [];

  const parsed = parseJson(text);
  return Array.isArray(parsed) ? parsed : [];
}

function getModuleKeyFromItem(item, fallbackIndex = 0) {
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

  return `index-${fallbackIndex}`;
}

function getModuleOrder(item, fallbackIndex = 0) {
  const moduleIndex = Number(item?.moduleIndex ?? item?.module_index);
  return Number.isInteger(moduleIndex) ? moduleIndex : fallbackIndex;
}

function normalizeCourseModule(module, index, course = {}) {
  const title = String(
    module?.title || module?.moduleTitle || module?.module_title || "",
  ).trim();
  const description = String(
    module?.description ||
      module?.moduleDescription ||
      module?.module_description ||
      module?.summary ||
      "",
  ).trim();
  const learningObjectives = String(
    module?.learningObjectives ||
      module?.learning_objectives ||
      module?.moduleLearningObjectives ||
      module?.module_learning_objectives ||
      "",
  ).trim();

  return {
    ...module,
    id:
      module?.id ||
      module?.lesson_id ||
      module?.moduleId ||
      module?.module_id ||
      `${course?.id || course?.course_id || "course"}-module-${index + 1}`,
    title: title || `Module ${index + 1}`,
    description,
    learningObjectives,
    learning_objectives: learningObjectives,
    lessonPages: getCourseLessonPages(module),
    quizItems: getCourseQuizItems(module),
  };
}

function buildModulesFromFlatContent(content) {
  const lessonPages = getCourseLessonPages(content);
  const quizItems = getCourseQuizItems(content);
  const modules = new Map();

  const ensureModule = (item, fallbackIndex = 0) => {
    const key = getModuleKeyFromItem(item, fallbackIndex);
    const existing = modules.get(key);

    if (existing) return existing;

    const order = getModuleOrder(item, modules.size);
    const moduleTitle = String(
      item?.moduleTitle || item?.module_title || "",
    ).trim();
    const moduleDescription = String(
      item?.moduleDescription || item?.module_description || "",
    ).trim();
    const moduleLearningObjectives = String(
      item?.moduleLearningObjectives || item?.module_learning_objectives || "",
    ).trim();
    const moduleId = item?.moduleId || item?.module_id;
    const module = {
      id:
        moduleId ||
        `${content?.id || content?.course_id || "course"}-module-${order + 1}`,
      title: moduleTitle || `Module ${order + 1}`,
      description: moduleDescription,
      learningObjectives:
        moduleLearningObjectives ||
        String(
          content?.learningObjectives || content?.learning_objectives || "",
        ).trim(),
      learning_objectives:
        moduleLearningObjectives ||
        String(
          content?.learningObjectives || content?.learning_objectives || "",
        ).trim(),
      lessonPages: [],
      quizItems: [],
      mainQuizSettings: item?.mainQuizSettings || item?.main_quiz_settings,
      mainQuizEnabled: item?.mainQuizEnabled ?? item?.main_quiz_enabled,
      mainQuizUnlockAt: item?.mainQuizUnlockAt || item?.main_quiz_unlock_at,
      mainQuizLockAt: item?.mainQuizLockAt || item?.main_quiz_lock_at,
      order,
    };

    modules.set(key, module);
    return module;
  };

  lessonPages.forEach((page, index) => {
    ensureModule(page, 0).lessonPages.push(page);
  });

  quizItems.forEach((item, index) => {
    ensureModule(item, 0).quizItems.push(item);
  });

  return [...modules.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ order, ...module }, index) => ({
      ...module,
      title: module.title || `Module ${index + 1}`,
    }));
}

export function getCourseContentModules(content) {
  const nestedModules =
    [
      content?.contentModules,
      content?.content_modules,
      content?.learningModules,
      content?.learning_modules,
    ]
      .map((value) => parseModuleList(value).filter(Boolean))
      .find((modules) => modules.length > 0) || [];

  if (nestedModules.length) {
    return nestedModules.map((module, index) =>
      normalizeCourseModule(module, index, content),
    );
  }

  const flatModules = buildModulesFromFlatContent(content);

  if (flatModules.length) {
    return flatModules;
  }

  return [];
}

export function getCourseModule(content, moduleIndex = 0) {
  const modules = getCourseContentModules(content);
  const safeIndex = Math.min(
    Math.max(Number(moduleIndex) || 0, 0),
    Math.max(modules.length - 1, 0),
  );

  return modules[safeIndex] || null;
}

export function normalizeCourseContent(source) {
  const lessonPages = getCourseLessonPages(source);
  const quizItems = getCourseQuizItems(source);
  const contentModules = getCourseContentModules(source);
  const id =
    source?.id || source?.course_id || source?.lesson_id || source?.module_id;
  const title =
    source?.title ||
    source?.courseName ||
    source?.course_name ||
    source?.course_title ||
    "Untitled course";
  const description =
    source?.summary || source?.description || source?.module_description || "";
  const learningObjectives =
    source?.learningObjectives || source?.learning_objectives || "";

  return {
    ...source,
    id,
    course_id: source?.course_id || id,
    lesson_id: source?.lesson_id || id,
    title,
    description,
    summary: description,
    learningObjectives,
    learning_objectives: learningObjectives,
    contentModules,
    content_modules: contentModules,
    lessonPages,
    lessonContent: JSON.stringify(lessonPages),
    lesson_content: JSON.stringify(lessonPages),
    quizItems,
    quizModule: JSON.stringify(quizItems),
    quiz_contents: JSON.stringify(quizItems),
    modules: contentModules.length || lessonPages.length,
    quizzes: quizItems.length,
  };
}

async function fetchLegacyContent(contentId) {
  const response = await fetch(
    `${API_BASE}/getLessonsById.php?id=${encodeURIComponent(contentId)}`,
    { credentials: "include" },
  );

  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data.message || "Course content not found.");
  }

  return data.lesson || data.module || data.course || data.data || data;
}

async function fetchModuleContent(contentId) {
  const response = await fetch(
    `${API_BASE}/modules/${encodeURIComponent(contentId)}`,
    {
      credentials: "include",
      headers: lessonAuthHeaders(),
    },
  );

  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data.message || "Learning module not found.");
  }

  return data.module || data.course || data.lesson || data.data || data;
}

async function findCourseByIdOrCode(contentId) {
  const normalizedId = String(contentId || "")
    .trim()
    .toLowerCase();
  const courses = await fetchCourses({
    includeArchived: true,
    summaryOnly: true,
  });

  const matchedCourse = courses.find((course) => {
    const id = String(course.id || course.course_id || "")
      .trim()
      .toLowerCase();
    const code = String(course.code || course.courseCode || "")
      .trim()
      .toLowerCase();
    return id === normalizedId || code === normalizedId;
  });

  if (!matchedCourse) return null;

  const detailId =
    matchedCourse.id ||
    matchedCourse.course_id ||
    matchedCourse.code ||
    matchedCourse.courseCode ||
    contentId;

  try {
    return await fetchCourse(detailId);
  } catch {
    return matchedCourse;
  }
}

export async function fetchCourseContent(contentId) {
  const cleanId = String(contentId || "").trim();
  if (!cleanId) throw new Error("Missing course id.");

  const errors = [];

  try {
    return normalizeCourseContent(await fetchCourse(cleanId));
  } catch (error) {
    errors.push(error);
  }

  try {
    const course = await findCourseByIdOrCode(cleanId);
    if (course) return normalizeCourseContent(course);
  } catch (error) {
    errors.push(error);
  }

  try {
    return normalizeCourseContent(await fetchModuleContent(cleanId));
  } catch (error) {
    errors.push(error);
  }

  try {
    return normalizeCourseContent(await fetchLegacyContent(cleanId));
  } catch (error) {
    errors.push(error);
  }

  throw errors.at(-1) || new Error("Course content not found.");
}

export function getCourseSlideCount(content) {
  return (
    getCourseLessonPages(content).length + getCourseQuizItems(content).length
  );
}
