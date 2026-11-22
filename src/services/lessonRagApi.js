import { API_BASE } from "../config.js";
import { lessonAuthHeaders } from "./lessonAuth.js";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}/lessons${path}`, {
    ...options,
    credentials: "include",
    headers: { ...lessonAuthHeaders(), ...options.headers },
    signal: AbortSignal.timeout(30000),
  });
  const data = await response
    .json()
    .catch(() => ({ message: "Server returned invalid JSON." }));
  if (!response.ok || !data.success)
    throw new Error(data.message || "Lesson request failed.");
  return data;
}

export async function waitForLessonJob(jobId, onProgress = () => {}) {
  const started = Date.now();
  while (Date.now() - started < 3600000) {
    const job = await request(`/jobs/${encodeURIComponent(jobId)}`);
    onProgress(job);
    window.dispatchEvent(
      new CustomEvent("lesson-rag-progress", { detail: job }),
    );
    if (job.status === "completed") return job.result;
    if (job.status === "failed") {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (
          key?.startsWith("puffy-rag-job:") &&
          localStorage.getItem(key) === jobId
        ) {
          localStorage.setItem(key + ":failed", jobId);
          localStorage.removeItem(key);
        }
      }
      throw new Error(job.message || "Lesson processing failed.");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(
    `Lesson is still processing. Job ID: ${jobId}. You can check it again later.`,
  );
}

export async function uploadLessonSource(formData, onProgress) {
  const queued = await request("/process-file", {
    method: "POST",
    body: formData,
  });
  const key = `puffy-rag-job:${formData.get("course_id")}:${formData.get("client_module_key") || formData.get("lesson_id") || "course"}`;
  localStorage.setItem(key, queued.job_id);
  const result = await waitForLessonJob(queued.job_id, onProgress);
  localStorage.removeItem(key);
  return { success: true, ...result };
}

export const listLessonSources = (courseId, moduleKey) =>
  request(`/sources?course_id=${encodeURIComponent(courseId)}` + (moduleKey != null ? `&module_key=${encodeURIComponent(moduleKey)}` : ""));
export const deleteLessonSource = (documentId) =>
  request(`/sources/${encodeURIComponent(documentId)}`, { method: "DELETE" });
export async function regenerateLessonSource(
  documentId,
  reindex = false,
  onProgress,
  onQueued = () => {},
  generationContext = null,
  moduleKey = null,
) {
  const queued = await request(
    `/sources/${encodeURIComponent(documentId)}/${reindex ? "reindex" : "generate"}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ generation_context: generationContext, client_module_key: moduleKey == null ? null : String(moduleKey) }) },
  );
  onQueued(queued.job_id);
  return waitForLessonJob(queued.job_id, onProgress);
}

export async function retryLessonGeneration(
  jobId,
  onProgress,
  onQueued = () => {},
) {
  const queued = await request(`/jobs/${encodeURIComponent(jobId)}/retry`, {
    method: "POST",
  });
  onQueued(queued.job_id);
  return waitForLessonJob(queued.job_id, onProgress);
}
