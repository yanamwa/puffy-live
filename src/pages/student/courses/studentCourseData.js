import {
  getProfessorCourseOwner,
  readProfessorCourses,
} from "../../professor/professorData.js";
import { API_BASE } from "../../../config.js";
import { fetchCourse, fetchCourses } from "../../../services/courseApi.js";

export const STUDENT_ENROLLED_COURSES_KEY = "student-enrolled-courses";
export const STUDENT_ENROLLED_COURSES_EVENT =
  "student-enrolled-courses-updated";
export const STUDENT_READING_PROGRESS_KEY = "student-reading-progress";
export const STUDENT_READING_PROGRESS_EVENT =
  "student-reading-progress-updated";

function getCourseKey(course) {
  return String(course?.id || course?.course_id || course?.code || "").trim();
}

function isEnabled(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function courseMatchesEnrollment(course, enrolledKeys) {
  return (
    enrolledKeys.has(String(course?.id || "").trim()) ||
    enrolledKeys.has(String(course?.course_id || "").trim()) ||
    enrolledKeys.has(String(course?.code || "").trim())
  );
}

function filterCourses(courses, params = {}) {
  const includeArchived = isEnabled(params.includeArchived);
  const publicOnly = isEnabled(params.public);
  const publishedOnly = isEnabled(params.published);

  return courses
    .filter((course) => includeArchived || !course.archived)
    .filter(
      (course) => !publicOnly || (course.visibility || "public") === "public",
    )
    .filter((course) => !publishedOnly || course.status === "published");
}

async function loadProfessorCourses(params = {}, options = {}) {
  try {
    const courses = await fetchCourses(params, options);
    return filterCourses(courses, params);
  } catch (error) {
    if (options.fallback === false) {
      throw error;
    }

    console.error("Student course API error:", error);
    return filterCourses(readProfessorCourses(), params);
  }
}

function getStoredUser() {
  try {
    const storedUser =
      localStorage.getItem("puffy-user") ||
      localStorage.getItem("user") ||
      localStorage.getItem("currentUser") ||
      sessionStorage.getItem("puffy-user") ||
      sessionStorage.getItem("user") ||
      sessionStorage.getItem("currentUser");

    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
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

function getStoredUserId() {
  const user = getStoredUser() || {};

  return (
    user.id ||
    user.userId ||
    user.user_id ||
    localStorage.getItem("user_id") ||
    null
  );
}

function getStudentEnrollmentStorageKey() {
  const user = getStoredUser() || {};
  const accountKey =
    getStoredUserId() ||
    user.email ||
    localStorage.getItem("user_email") ||
    localStorage.getItem("email") ||
    "anonymous";

  return `${STUDENT_ENROLLED_COURSES_KEY}:${String(accountKey).trim().toLowerCase()}`;
}

function getAuthHeaders() {
  const token = getStoredToken();
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function readJsonResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({
    success: false,
    message: "Server returned an invalid response.",
  }));

  if (!response.ok || data.success === false) {
    const error = new Error(data.message || fallbackMessage);
    error.status = response.status;
    throw error;
  }

  return data;
}

async function fetchEnrolledCoursesRequest(params = {}) {
  const token = getStoredToken();
  const userId = getStoredUserId();

  if (!token && !userId) {
    return [];
  }

  const query = new URLSearchParams();

  if (userId) {
    query.set("userId", userId);
  }

  Object.entries({ summaryOnly: true, ...params }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });

  const response = await fetch(
    `${API_BASE}/courses/enrolled${query.toString() ? `?${query}` : ""}`,
    {
      method: "GET",
      credentials: "include",
      headers: getAuthHeaders(),
    },
  );
  const data = await readJsonResponse(
    response,
    "Could not load enrolled courses.",
  );

  return Array.isArray(data.courses) ? data.courses : [];
}

async function enrollCourseRequest(course) {
  const token = getStoredToken();
  const userId = getStoredUserId();

  if (!token && !userId) {
    return null;
  }

  const response = await fetch(`${API_BASE}/courses/enroll?summaryOnly=true`, {
    method: "POST",
    credentials: "include",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      userId,
      courseId: course?.id || course?.course_id || null,
      courseCode:
        course?.courseCode || course?.course_code || course?.code || "",
      summaryOnly: true,
    }),
  });
  const data = await readJsonResponse(response, "Could not enroll in course.");

  return data.course || null;
}

function dispatchEnrollmentUpdate(course) {
  window.dispatchEvent(
    new CustomEvent(STUDENT_ENROLLED_COURSES_EVENT, {
      detail: { course },
    }),
  );
}

function getProfessorCourseDepartment(course) {
  return (
    course.professorDepartment ||
    course.professor_department ||
    course.database_professor_department ||
    course.department ||
    ""
  );
}

function getProfessorCourseProfileImage(course) {
  return (
    course.professorProfileImage ||
    course.professor_profile_image ||
    course.database_professor_profile_image ||
    course.professorAvatar ||
    course.professor_avatar ||
    ""
  );
}

function clampProgress(value) {
  const progress = Number(value);
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(Math.round(progress), 100));
}

function getProgressKey(contentId) {
  return String(contentId || "").trim();
}

export function getStudentProgressStorageKey(
  baseKey = STUDENT_READING_PROGRESS_KEY,
) {
  const user = getStoredUser() || {};
  const userId = getStoredUserId();
  const email =
    user.email ||
    localStorage.getItem("user_email") ||
    localStorage.getItem("email");
  const accountKey =
    userId != null && String(userId).trim()
      ? `id:${String(userId).trim()}`
      : email
        ? `email:${String(email).trim().toLowerCase()}`
        : null;

  return accountKey ? `${baseKey}:${encodeURIComponent(accountKey)}` : null;
}

function readReadingProgressMap() {
  try {
    const storageKey = getStudentProgressStorageKey();
    if (!storageKey) return {};
    // Shared historical records have no owner and cannot be assigned safely.
    const saved = localStorage.getItem(storageKey);
    const parsed = saved ? JSON.parse(saved) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function getLegacyLessonProgress(contentId) {
  try {
    const storageKey = getStudentProgressStorageKey(
      `lessonProgress_${contentId}`,
    );
    if (!storageKey) return 0;
    const saved = localStorage.getItem(storageKey);
    const parsed = saved ? JSON.parse(saved) : null;
    return clampProgress(parsed?.progress_percent ?? parsed?.progress ?? 0);
  } catch {
    return 0;
  }
}

function getLegacyModuleProgress(contentId, moduleIndex) {
  try {
    const storageKey = getStudentProgressStorageKey(
      `lessonProgress_${contentId}_module_${moduleIndex}`,
    );
    if (!storageKey) return 0;
    const saved = localStorage.getItem(storageKey);
    const parsed = saved ? JSON.parse(saved) : null;
    return clampProgress(parsed?.progress_percent ?? parsed?.progress ?? 0);
  } catch {
    return 0;
  }
}

function getSavedModuleProgress(savedProgress, moduleIndex) {
  const moduleKey = String(moduleIndex);
  const moduleRecord = savedProgress?.modules?.[moduleKey];
  const moduleRecordProgress = clampProgress(
    moduleRecord?.progress ?? moduleRecord?.moduleProgress,
  );

  if (moduleRecordProgress > 0) {
    return moduleRecordProgress;
  }

  const savedModuleIndex = Number(
    savedProgress?.moduleIndex ?? savedProgress?.module_index,
  );

  if (Number.isInteger(savedModuleIndex) && savedModuleIndex === moduleIndex) {
    return clampProgress(
      savedProgress?.moduleProgress ?? savedProgress?.module_progress,
    );
  }

  return 0;
}

export function getStudentReadingProgress(contentId) {
  const key = getProgressKey(contentId);
  if (!key) return 0;

  const progressMap = readReadingProgressMap();
  const savedProgress = progressMap[key];
  const progress = clampProgress(
    typeof savedProgress === "number" ? savedProgress : savedProgress?.progress,
  );

  return Math.max(progress, getLegacyLessonProgress(key));
}

export function saveStudentReadingProgress(contentId, progress, metadata = {}) {
  const key = getProgressKey(contentId);
  const storageKey = getStudentProgressStorageKey();
  if (!key || !storageKey) return 0;

  const progressMap = readReadingProgressMap();
  const currentRecord =
    progressMap[key] && typeof progressMap[key] === "object"
      ? progressMap[key]
      : {};
  const currentProgress = clampProgress(
    progressMap[key]?.progress ?? progressMap[key],
  );
  const nextProgress = Math.max(currentProgress, clampProgress(progress));
  const moduleIndex = Number(metadata.moduleIndex ?? metadata.module_index);
  const nextModules = {
    ...(currentRecord.modules || {}),
  };

  if (Number.isInteger(moduleIndex)) {
    const moduleKey = String(moduleIndex);
    const currentModuleProgress = clampProgress(
      nextModules[moduleKey]?.progress ??
        nextModules[moduleKey]?.moduleProgress,
    );
    const nextModuleProgress = Math.max(
      currentModuleProgress,
      clampProgress(
        metadata.moduleProgress ?? metadata.module_progress ?? progress,
      ),
    );

    nextModules[moduleKey] = {
      ...nextModules[moduleKey],
      moduleIndex,
      moduleTitle:
        metadata.moduleTitle ||
        metadata.module_title ||
        nextModules[moduleKey]?.moduleTitle ||
        "",
      progress: nextModuleProgress,
      updatedAt: new Date().toISOString(),
    };
  }

  const nextRecord = {
    ...metadata,
    progress: nextProgress,
    updatedAt: new Date().toISOString(),
  };

  if (Object.keys(nextModules).length > 0) {
    nextRecord.modules = nextModules;
  }

  progressMap[key] = nextRecord;
  localStorage.setItem(storageKey, JSON.stringify(progressMap));

  window.dispatchEvent(
    new CustomEvent(STUDENT_READING_PROGRESS_EVENT, {
      detail: { contentId: key, progress: nextProgress },
    }),
  );

  return nextProgress;
}

export function getStudentModuleReadingProgress(
  contentId,
  moduleIndex,
  moduleCount,
) {
  const key = getProgressKey(contentId);
  if (!key) return 0;

  const progressMap = readReadingProgressMap();
  const savedProgress = progressMap[key];
  const exactModuleProgress = Math.max(
    getSavedModuleProgress(savedProgress, moduleIndex),
    getLegacyModuleProgress(key, moduleIndex),
  );

  // A course-wide percentage cannot prove that a newly added module was read.
  return exactModuleProgress;
}

export function readStudentEnrollmentKeys() {
  try {
    const saved = localStorage.getItem(getStudentEnrollmentStorageKey());
    const parsed = saved ? JSON.parse(saved) : [];

    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function saveStudentEnrollmentKeys(keys) {
  const uniqueKeys = [...new Set(keys.map(String).filter(Boolean))];
  localStorage.setItem(
    getStudentEnrollmentStorageKey(),
    JSON.stringify(uniqueKeys),
  );
  return uniqueKeys;
}

export function getStudentCourseModules(course) {
  const lessonPages = Array.isArray(course?.lessonPages)
    ? course.lessonPages
    : [];

  if (lessonPages.length) {
    return lessonPages.map((page, index) => ({
      id: `${getCourseKey(course)}-lesson-${index}`,
      title: page.title || `Lesson Page ${index + 1}`,
      description: page.content || "",
    }));
  }

  return [
    {
      id: `${getCourseKey(course)}-overview`,
      title: "Module Overview",
      description: course?.summary || "Start with the module overview.",
    },
  ];
}

export function normalizeStudentCourse(course) {
  const title =
    course.title ||
    course.courseName ||
    course.course_name ||
    course.subject ||
    "Untitled course";
  const professorDepartment = getProfessorCourseDepartment(course);

  return {
    ...course,
    id: course.id || course.course_id,
    code: course.code || "COURSE",
    title,
    courseName: course.courseName || title,
    course_name: course.course_name || title,
    instructor: getProfessorCourseOwner(course),
    professorDepartment,
    professor_department: professorDepartment,
    professorProfileImage: getProfessorCourseProfileImage(course),
    professor_profile_image: getProfessorCourseProfileImage(course),
    modulesList: getStudentCourseModules(course),
  };
}

export function findCourseByIdOrCode(value) {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();

  return readProfessorCourses().find((course) => {
    const id = String(course.id || "")
      .trim()
      .toLowerCase();
    const code = String(course.code || "")
      .trim()
      .toLowerCase();
    return id === normalizedValue || code === normalizedValue;
  });
}

export async function findCourseByIdOrCodeAsync(value) {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalizedValue) return null;

  if (/^\d+$/.test(normalizedValue)) {
    try {
      return await fetchCourse(normalizedValue);
    } catch {
      // Fall through to searching all courses; route params may be old codes.
    }
  }

  const courses = await loadProfessorCourses({
    includeArchived: true,
    summaryOnly: true,
  });
  const matchedCourse = courses.find((course) => {
    const id = String(course.id || course.course_id || "")
      .trim()
      .toLowerCase();
    const code = String(course.code || "")
      .trim()
      .toLowerCase();
    return id === normalizedValue || code === normalizedValue;
  });

  if (!matchedCourse) return null;

  const detailId =
    matchedCourse.id ||
    matchedCourse.course_id ||
    matchedCourse.code ||
    matchedCourse.courseCode ||
    value;

  try {
    return await fetchCourse(detailId);
  } catch {
    return matchedCourse;
  }
}

export function findJoinableCourseByCode(code) {
  const normalizedCode = String(code || "")
    .trim()
    .toLowerCase();

  if (!normalizedCode) return null;

  return readProfessorCourses().find(
    (course) =>
      !course.archived &&
      course.status === "published" &&
      String(course.code || "")
        .trim()
        .toLowerCase() === normalizedCode,
  );
}

export async function findJoinableCourseByCodeAsync(code) {
  const normalizedCode = String(code || "")
    .trim()
    .toLowerCase();

  if (!normalizedCode) return null;

  const courses = await loadProfessorCourses({
    published: true,
    summaryOnly: true,
  });

  return (
    courses.find(
      (course) =>
        !course.archived &&
        course.status === "published" &&
        String(course.code || course.courseCode || course.course_code || "")
          .trim()
          .toLowerCase() === normalizedCode,
    ) || null
  );
}

export function enrollStudentInCourse(course) {
  const key = getCourseKey(course);

  if (!key) return false;

  const keys = readStudentEnrollmentKeys();
  saveStudentEnrollmentKeys([...keys, key]);

  dispatchEnrollmentUpdate(course);
  return true;
}

export async function enrollStudentInCourseAsync(course) {
  let enrolledCourse = course;

  try {
    enrolledCourse = (await enrollCourseRequest(course)) || course;
  } catch (error) {
    if (error.status && error.status !== 401) {
      console.warn("Course enrollment API fallback:", error.message);
    }
  }

  enrollStudentInCourse(enrolledCourse);
  return enrolledCourse;
}

export function getStudentEnrolledCourses() {
  const enrolledKeys = new Set(readStudentEnrollmentKeys());

  return readProfessorCourses()
    .filter((course) => courseMatchesEnrollment(course, enrolledKeys))
    .filter((course) => !course.archived)
    .map(normalizeStudentCourse);
}

export function getStudentArchivedCourses() {
  const enrolledKeys = new Set(readStudentEnrollmentKeys());

  return readProfessorCourses()
    .filter((course) => courseMatchesEnrollment(course, enrolledKeys))
    .filter((course) => course.archived)
    .map(normalizeStudentCourse);
}

export async function loadStudentEnrolledCourses() {
  try {
    const enrolledCourses = await fetchEnrolledCoursesRequest();

    if (enrolledCourses.length) {
      saveStudentEnrollmentKeys(enrolledCourses.map(getCourseKey));
      return enrolledCourses.map(normalizeStudentCourse);
    }

    if (getStoredToken() || getStoredUserId()) {
      saveStudentEnrollmentKeys([]);
      return [];
    }
  } catch (error) {
    if (error.status && error.status !== 401) {
      console.warn("Enrolled courses API fallback:", error.message);
    }
  }

  const enrolledKeys = new Set(readStudentEnrollmentKeys());
  const courses = await loadProfessorCourses();

  return courses
    .filter((course) => courseMatchesEnrollment(course, enrolledKeys))
    .map(normalizeStudentCourse);
}

export async function loadStudentArchivedCourses() {
  const token = getStoredToken();

  if (!token) {
    return [];
  }

  try {
    const response = await fetch(
      `${API_BASE}/courses/archived?summaryOnly=true`,
      {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      },
    );

    const data = await readJsonResponse(
      response,
      "Could not load archived classes.",
    );

    const archivedCourses = Array.isArray(data.courses) ? data.courses : [];

    return archivedCourses.map(normalizeStudentCourse);
  } catch (error) {
    console.error("Archived courses loading error:", error);

    return [];
  }
}

export function getPublicStudentCourses() {
  return readProfessorCourses()
    .filter((course) => !course.archived)
    .filter((course) => course.status === "published")
    .map(normalizeStudentCourse);
}

export async function loadPublicStudentCourses() {
  const userId = getStoredUserId();
  const courses = await loadProfessorCourses(
    {
      published: true,
      summaryOnly: true,
      ...(userId ? { userId } : {}),
    },
    { fallback: false },
  );
  return courses.map(normalizeStudentCourse);
}
