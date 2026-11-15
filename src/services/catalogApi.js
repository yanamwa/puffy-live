import { API_BASE } from "../config.js";
import { lessonAuthHeaders } from "./lessonAuth.js";

export async function catalogRequest(path = "", options = {}) {
  const response = await fetch(`${API_BASE}/catalog${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...lessonAuthHeaders(),
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  const data = await response
    .json()
    .catch(() => ({ message: "The server returned an invalid response." }));
  if (!response.ok || data.success === false)
    throw Object.assign(
      new Error(data.message || "Course catalog request failed."),
      { status: response.status, code: data.code, matches: data.matches },
    );
  return data;
}
export async function catalogPdf(path, signal) {
  const response = await fetch(`${API_BASE}/catalog${path}`, {
    credentials: "include",
    headers: lessonAuthHeaders(),
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Could not load syllabus PDF.");
  }
  return response.blob();
}
export function notifyCatalogChanged() {
  window.dispatchEvent(new Event("puffy-catalog-updated"));
}
