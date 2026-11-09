import { API_BASE } from "../config";
import { summarizeAssessment } from "../utils/assessmentAnalytics.js";

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

export async function fetchProfessorAssessmentSummary({ signal } = {}) {
  const report = await request("/reports/professor/assessments", signal);
  const courses = new Map();
  for (const student of report.students) {
    if (!student.scoredAttempts) continue;
    const [courseId] = student.key.split(":");
    if (!courses.has(courseId)) {
      courses.set(
        courseId,
        request(`/assessment-attempts/${encodeURIComponent(courseId)}`, signal)
          .then(({ attempts }) => attempts)
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
      const courseAttempts = student.scoredAttempts
        ? await courses.get(courseId)
        : [];
      if (!Array.isArray(courseAttempts)) return student;

      const attempts = courseAttempts.filter(
        (attempt) =>
          String(attempt.user_id) === studentId &&
          attempt.score != null &&
          Number.isFinite(Number(attempt.score)) &&
          Number(attempt.total) > 0,
      );
      const practiceAttempts = attempts.filter(
        (attempt) => attempt.assessment_type === "practice",
      );
      const topics = summarizeAssessment(attempts, [], [])
        .topics.filter(({ label }) => label !== "Unclassified")
        .sort(
          (a, b) => a.percent - b.percent || a.label.localeCompare(b.label),
        );

      return { ...student, practiceAttempts, topics };
    }),
  );
  return { ...report, students };
}
