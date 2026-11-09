import { API_BASE } from "../config.js";
import { lessonAuthHeaders } from "./lessonAuth.js";

async function parseResponse(response) {
  const data = await response.json().catch(() => ({
    success: false,
    message: "Server returned an invalid response.",
  }));

  if (!response.ok || data.success === false) {
    throw new Error(data.message || "Monitoring request failed.");
  }

  return data;
}

export async function fetchCourseMonitoring(courseId) {
  const response = await fetch(
    `${API_BASE}/monitoring/${encodeURIComponent(courseId)}`,
    {
      credentials: "include",
      headers: lessonAuthHeaders(),
    },
  );
  const data = await parseResponse(response);

  return data.monitoring;
}
