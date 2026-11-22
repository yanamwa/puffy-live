import { API_BASE } from "../config";
import { summarizeEnrollmentPractice } from "../utils/assessmentAnalytics.js";
import { assessmentModules } from "../utils/assessmentModuleScope.js";

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("puffy-token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken") ||
    sessionStorage.getItem("puffy-token")
  );
}

async function request(path, signal) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${getToken() || ""}`,
    },
    signal,
    cache: "no-store",
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.success) {
    throw new Error(
      result.message || `Reports request failed (${response.status})`,
    );
  }

  return result;
}

// Fetch complete Admin Reports data
export function fetchReports({ start, end, signal } = {}) {
  const params = new URLSearchParams();

  if (start) params.set("start", start);
  if (end) params.set("end", end);

  return request(`/reports${params.size ? `?${params}` : ""}`, signal);
}

// Fetch passing threshold and academic calendar
export async function fetchReportConfig({ signal } = {}) {
  const result = await request("/reports/config", signal);

  return result.settings;
}

export async function fetchProfessorAssessmentSummary({ signal, courses = [] } = {}) {
  const report = await request("/reports/professor/assessments", signal);
  const modulesByCourse = new Map(
    courses.map((course) => [String(course.id), assessmentModules(course.raw ?? course)]),
  );
  const histories = new Map();
  for (const student of report.students) {
    const [courseId] = student.key.split(":");
    if (!histories.has(courseId)) {
      histories.set(
        courseId,
        request(`/assessment-attempts/${encodeURIComponent(courseId)}`, signal)
          .then(({ attempts }) => {
            if (!Array.isArray(attempts)) return null;
            const byStudent = new Map();
            for (const attempt of attempts) {
              const id = String(attempt.user_id ?? attempt.userId);
              if (!byStudent.has(id)) byStudent.set(id, []);
              byStudent.get(id).push(attempt);
            }
            return byStudent;
          })
          .catch((error) => {
            if (signal?.aborted) throw error;
            return null;
          }),
      );
    }
  }
  const students = await Promise.all(
    report.students.map(async (student) => {
      const [courseId, studentId] = student.key.split(":");
      const byStudent = await histories.get(courseId);
      const attempts = byStudent ? byStudent.get(studentId) ?? [] : null;
      return summarizeEnrollmentPractice(student, attempts, modulesByCourse.get(courseId) ?? []);
    }),
  );
  return { ...report, students };
}
