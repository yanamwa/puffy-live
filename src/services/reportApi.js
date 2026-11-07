
import { API_BASE } from "../config";

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
      result.message ||
        `Reports request failed (${response.status})`
    );
  }

  return result;
}

// Fetch complete Admin Reports data
export function fetchReports({ start, end, signal } = {}) {
  const params = new URLSearchParams();

  if (start) params.set("start", start);
  if (end) params.set("end", end);

  return request(
    `/reports${params.size ? `?${params}` : ""}`,
    signal
  );
}

// Fetch passing threshold and academic calendar
export async function fetchReportConfig({ signal } = {}) {
  const result = await request("/reports/config", signal);

  return result.settings;
}

export function fetchProfessorAssessmentSummary({ signal } = {}) {
  return request("/reports/professor/assessments", signal);
}
