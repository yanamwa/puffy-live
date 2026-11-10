import { API_BASE } from "../config.js";
import { lessonAuthHeaders } from "./lessonAuth.js";

export async function generateModuleRecap({ courseId, moduleId, title, objectives, pages, existing = [] }, request = fetch) {
  if (existing.length) return { questions: existing, keptExisting: true };
  const lessonContent = pages
    .filter((page) => String(page.content || "").trim())
    .map((page) => `${page.title || ""}\n${page.content}`.trim())
    .join("\n\n");
  if (!lessonContent) return { questions: existing };
  const documentIds = [...new Set(pages.flatMap((page) => [
    ...(page.source_document_ids || []),
    ...(page.source_document_id ? [page.source_document_id] : []),
  ]))];
  try {
    const response = await request(`${API_BASE}/lessons/generate-quiz`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...lessonAuthHeaders() },
      body: JSON.stringify({
        course_id: Number(courseId),
        lesson_id: Number.isInteger(Number(moduleId)) && Number(moduleId) > 0 ? Number(moduleId) : null,
        document_ids: documentIds,
        lesson_title: title,
        lesson_content: lessonContent,
        learning_objectives: objectives,
        assessment_type: "recap",
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "Quick Recap generation failed.");
    const questions = (data.quiz?.questions || []).filter((question) => String(question.question || "").trim());
    if (!questions.length) throw new Error("No valid Quick Recap questions were returned.");
    return { questions };
  } catch (error) {
    return { questions: existing, error: error.message || "Quick Recap generation failed." };
  }
}
