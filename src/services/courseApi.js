import { API_BASE } from "../config.js";
import {
  getCurrentProfessorIdentity,
  readProfessorCourses,
  loadProfessorCourseStorage,
  saveProfessorCourses,
  stampCourseForProfessor,
} from "../pages/professor/professorData.js";

const COURSE_REQUEST_TIMEOUT_MS = 5000;

function isEnabled(value) {
  return value === true || value === 1 || value === "1" || value === "true";
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

function readList(...values) {
  for (const value of values) {
    const parsed = parseList(value);

    if (parsed.length) return parsed;
  }

  return [];
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

function getStoredToken() {
  return (
    localStorage.getItem("puffy-token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("puffy-token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken") ||
    ""
  );
}

function getAuthHeaders(headers = {}) {
  const token = getStoredToken();
  const nextHeaders = { ...headers };

  if (token) {
    nextHeaders.Authorization = `Bearer ${token}`;
  }

  return nextHeaders;
}

function normalizeContentModule(module, index) {
  const mainQuizSettings = normalizeMainQuizSettings(module);

  return {
    ...module,
    id:
      module?.id ||
      module?.lesson_id ||
      module?.module_id ||
      `module-${index + 1}`,
    title: module?.title || `Module ${index + 1}`,
    description:
      module?.description ||
      module?.module_description ||
      module?.summary ||
      "",
    learningObjectives:
      module?.learningObjectives || module?.learning_objectives || "",
    learning_objectives:
      module?.learning_objectives || module?.learningObjectives || "",
    lessonPages: readList(
      module?.lessonPages,
      module?.lesson_pages,
      module?.lessonContent,
      module?.lesson_content,
      module?.lesson_contents,
    ),
    quizItems: readList(
      module?.quizItems,
      module?.quiz_items,
      module?.quizModule,
      module?.quiz_contents,
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

function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  return value === "publish" || value === "published" ? "published" : "draft";
}

function normalizeVisibility(visibility) {
  return String(visibility || "").toLowerCase() === "public"
    ? "public"
    : "private";
}

function normalizeLocalCourse(course) {
  const id = course.id || course.course_id || `local-${Date.now()}`;
  const code = String(
    course.code || course.courseCode || course.course_code || "",
  ).toUpperCase();
  const title =
    course.title ||
    course.courseName ||
    course.course_name ||
    course.subject ||
    code ||
    "Untitled course";
  const summary = course.summary || course.description || "";
  const lessonPages = readList(
    course.lessonPages,
    course.lessonContent,
    course.lesson_pages,
  );
  const quizItems = readList(
    course.quizItems,
    course.quizModule,
    course.quiz_items,
  );
  const contentModules = readList(
    course.contentModules,
    course.content_modules,
  ).map(normalizeContentModule);
  const learningObjectives =
    course.learningObjectives ||
    course.learning_objectives ||
    contentModules
      .map((module) => module.learningObjectives)
      .filter(Boolean)
      .join("\n\n");

  return {
    ...course,
    id,
    course_id: course.course_id || id,
    title,
    courseName: course.courseName || title,
    course_name: course.course_name || title,
    code,
    courseCode: course.courseCode || code,
    course_code: course.course_code || code,
    summary,
    description: course.description || summary,
    subject: course.subject || title,
    learningObjectives,
    learning_objectives: learningObjectives,
    status: normalizeStatus(course.status),
    visibility: normalizeVisibility(course.visibility),
    contentModules,
    content_modules: contentModules,
    lessonPages,
    lessonContent: JSON.stringify(lessonPages),
    lesson_content: JSON.stringify(lessonPages),
    quizItems,
    quizModule: JSON.stringify(quizItems),
    quiz_contents: JSON.stringify(quizItems),
    students: Number(course.students || 0),
    modules:
      contentModules.length ||
      Number(course.modules || 0) ||
      lessonPages.length,
    moduleCount:
      contentModules.length ||
      Number(course.moduleCount || course.module_count || 0),
    module_count:
      contentModules.length ||
      Number(course.module_count || course.moduleCount || 0),
    lessonPageCount: lessonPages.length || Number(course.lessonPageCount || 0),
    lesson_page_count:
      lessonPages.length || Number(course.lesson_page_count || 0),
    quizzes: quizItems.length || Number(course.quizzes || 0),
    joinLink:
      course.joinLink || `/student/join?courseCode=${encodeURIComponent(code)}`,
    join_link:
      course.join_link ||
      course.joinLink ||
      `/student/join?courseCode=${encodeURIComponent(code)}`,
    archived:
      course.archived === true ||
      course.archived === 1 ||
      course.archived === "1" ||
      course.archived === "true",
    professorDepartment:
      course.professorDepartment ||
      course.professor_department ||
      course.department ||
      "",
    professor_department:
      course.professor_department ||
      course.professorDepartment ||
      course.department ||
      "",
    professorProfileImage:
      course.professorProfileImage ||
      course.professor_profile_image ||
      course.professorAvatar ||
      course.professor_avatar ||
      "",
    professor_profile_image:
      course.professor_profile_image ||
      course.professorProfileImage ||
      course.professorAvatar ||
      course.professor_avatar ||
      "",
    updatedAt: course.updatedAt || new Date().toISOString().slice(0, 10),
  };
}

function filterLocalCourses(courses, params = {}) {
  const includeArchived = isEnabled(params.includeArchived);
  const publicOnly = isEnabled(params.public);
  const publishedOnly = isEnabled(params.published);

  return courses
    .map(normalizeLocalCourse)
    .filter((course) => includeArchived || !course.archived)
    .filter((course) => !publicOnly || course.visibility === "public")
    .filter((course) => !publishedOnly || course.status === "published");
}

function findLocalCourse(id) {
  const normalizedId = String(id || "")
    .trim()
    .toLowerCase();

  return readProfessorCourses()
    .map(normalizeLocalCourse)
    .find((course) => {
      const courseId = String(course.id || course.course_id || "")
        .trim()
        .toLowerCase();
      const courseCode = String(course.code || "")
        .trim()
        .toLowerCase();
      return courseId === normalizedId || courseCode === normalizedId;
    });
}

function canUseLocalWriteFallback(error) {
  return !error.status || error.status === 404 || error.status >= 500;
}

async function saveLocalCourse(course) {
  await loadProfessorCourseStorage();
  const courses = readProfessorCourses().map(normalizeLocalCourse);
  const hasId =
    course.id !== undefined && course.id !== null && course.id !== "";
  const professor = getCurrentProfessorIdentity();
  const normalizedCourse = normalizeLocalCourse({
    ...stampCourseForProfessor(course, professor),
    id: hasId ? course.id : `local-${Date.now()}`,
    updatedAt: course.updatedAt || new Date().toISOString().slice(0, 10),
  });
  const nextCourses = hasId
    ? courses.map((item) =>
        String(item.id) === String(normalizedCourse.id)
          ? normalizedCourse
          : item,
      )
    : [normalizedCourse, ...courses];
  const courseExists = nextCourses.some(
    (item) => String(item.id) === String(normalizedCourse.id),
  );

  await saveProfessorCourses(
    courseExists ? nextCourses : [normalizedCourse, ...nextCourses],
  );
  return normalizedCourse;
}

async function deleteLocalCourse(id) {
  await loadProfessorCourseStorage();
  const courses = readProfessorCourses().map(normalizeLocalCourse);
  const normalizedId = String(id || "");
  const nextCourses = courses.filter(
    (course) => String(course.id) !== normalizedId,
  );

  await saveProfessorCourses(nextCourses);

  return {
    success: true,
    message: "Course deleted locally.",
  };
}

async function archiveLocalCourse(id, archived = true) {
  await loadProfessorCourseStorage();
  const courses = readProfessorCourses().map(normalizeLocalCourse);
  const normalizedId = String(id || "");
  let updatedCourse = null;

  const nextCourses = courses.map((course) => {
    if (
      String(course.id) !== normalizedId &&
      String(course.course_id) !== normalizedId
    ) {
      return course;
    }

    updatedCourse = normalizeLocalCourse({
      ...course,
      archived,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
    return updatedCourse;
  });

  await saveProfessorCourses(nextCourses);

  return {
    success: true,
    message: archived ? "Course archived locally." : "Course restored locally.",
    course: updatedCourse,
  };
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({
    success: false,
    message: "Server returned an invalid response.",
  }));

  if (!response.ok || data.success === false) {
    const error = new Error(data.message || "Course request failed.");
    error.status = response.status;
    throw error;
  }

  return data;
}

async function requestCourse(url, options = {}) {
  let response;
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    COURSE_REQUEST_TIMEOUT_MS,
  );

  try {
    response = await fetch(url, {
      ...options,
      headers: getAuthHeaders(options.headers),
      signal: controller.signal,
    });
  } catch (fetchError) {
    const error = new Error(
      fetchError.name === "AbortError"
        ? "The courses API took too long to respond."
        : "Could not reach the courses API. Make sure the server is running.",
    );
    error.status = 0;
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }

  return parseResponse(response);
}

export async function fetchCourseEnrollmentCount(courseId) {
  const data = await requestCourse(
    `${API_BASE}/courses/${encodeURIComponent(courseId)}/enrollments`,
    { credentials: "include", headers: { Accept: "application/json" } },
  );

  if (!Array.isArray(data.enrolled)) {
    throw new Error("The enrollment API returned an invalid student list.");
  }

  return data.enrolled.length;
}

export async function fetchCourses(params = {}, options = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });

  try {
    const data = await requestCourse(
      `${API_BASE}/courses${query.toString() ? `?${query}` : ""}`,
      {
        credentials: "include",
      },
    );

    return data.courses || data.modules || [];
  } catch (error) {
    if (options.fallback === false) {
      throw error;
    }

    console.warn("Using local course data:", error.message);
    await loadProfessorCourseStorage();
    return filterLocalCourses(readProfessorCourses(), params);
  }
}

export async function fetchCourse(id) {
  try {
    const data = await requestCourse(
      `${API_BASE}/courses/${encodeURIComponent(id)}`,
      {
        credentials: "include",
      },
    );

    return data.course || data.module;
  } catch (error) {
    await loadProfessorCourseStorage();
    const localCourse = findLocalCourse(id);

    if (localCourse) return localCourse;

    throw error;
  }
}

export async function saveCourse(course, options = {}) {
  course = {
    ...course,
    visibility:
      normalizeStatus(course.status) === "published" ? "public" : "private",
  };
  // Carry module metadata through APIs that persist only flat lesson/quiz JSON.
  if (Array.isArray(course.contentModules)) {
    const flatten = (field) =>
      course.contentModules.flatMap((module, moduleIndex) =>
        (module[field] || []).map((item) => ({
          ...item,
          moduleId: module.id,
          moduleIndex,
          moduleTitle: module.title,
          moduleDescription: module.description,
          moduleLearningObjectives: module.learningObjectives,
          mainQuizSettings: normalizeMainQuizSettings(module),
        })),
      );
    const lessonPages = flatten("lessonPages");
    const quizItems = flatten("quizItems");
    course = {
      ...course,
      content_modules: course.contentModules,
      lessonPages,
      lessonContent: JSON.stringify(lessonPages),
      lesson_content: JSON.stringify(lessonPages),
      quizItems,
      quizModule: JSON.stringify(quizItems),
      quiz_contents: JSON.stringify(quizItems),
    };
  }
  const hasId =
    course.id !== undefined && course.id !== null && course.id !== "";

  try {
    const data = await requestCourse(
      hasId
        ? `${API_BASE}/courses/${encodeURIComponent(course.id)}`
        : `${API_BASE}/courses`,
      {
        method: hasId ? "PUT" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(course),
      },
    );

    return data.course || data.module;
  } catch (error) {
    if (course.catalogId || course.catalog_id || options.fallback === false || !canUseLocalWriteFallback(error))
      throw error;

    console.warn("Saving course locally:", error.message);
    return saveLocalCourse(course);
  }
}

export async function deleteCourseById(id, options = {}) {
  try {
    return await requestCourse(
      `${API_BASE}/courses/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        credentials: "include",
      },
    );
  } catch (error) {
    if (options.fallback === false) {
      throw error;
    }

    if (!canUseLocalWriteFallback(error)) {
      throw error;
    }

    console.warn("Deleting course locally:", error.message);
    return deleteLocalCourse(id);
  }
}

export async function archiveCourseById(id, archived = true, options = {}) {
  try {
    return await requestCourse(
      `${API_BASE}/courses/${encodeURIComponent(id)}/archive`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ archived, archiveReason: options.archiveReason }),
      },
    );
  } catch (error) {
    if (options.fallback === false) {
      throw error;
    }

    if (!canUseLocalWriteFallback(error)) {
      throw error;
    }

    console.warn("Archiving course locally:", error.message);
    return archiveLocalCourse(id, archived);
  }
}
