import { API_BASE } from "../config.js";
import { lessonAuthHeaders } from "./lessonAuth.js";
import { buildPracticeQuizPrompt } from "./practiceQuizPrompt.js";

export async function generateModulePractice({ courseId, moduleId, title, objectives, pages, existing = [] }, request = fetch) {
  if (existing.length) return { questions: existing, keptExisting: true };
  const lessonContent = pages.map(page => `${page.title || ""}\n${page.content || ""}`).join("\n\n");
  const settings = {questionCount: 5, multipleChoiceCount: 3, identificationCount: 1, trueFalseCount: 1, lotsCount: 3, hotsCount: 2};
  try {
    const response = await request(`${API_BASE}/lessons/generate-quiz`, {
      method: "POST", credentials: "include",
      headers: {"Content-Type": "application/json", ...lessonAuthHeaders()},
      body: JSON.stringify({
        course_id: Number(courseId),
        lesson_id: Number.isInteger(Number(moduleId)) && Number(moduleId) > 0 ? Number(moduleId) : null,
        document_ids: [...new Set(pages.flatMap(p => [...(p.source_document_ids || []), ...(p.source_document_id ? [p.source_document_id] : [])]))],
        lesson_title: title, lesson_content: lessonContent, learning_objectives: objectives,
        assessment_type: "practice", question_count: 5, multiple_choice_count: 3,
        identification_count: 1, true_false_count: 1, lots_count: 3, hots_count: 2,
        prompt: buildPracticeQuizPrompt({...settings, lessonTitle: title, learningObjectives: objectives, lessonContent}) +
          "\nUse the lesson Practice Activity prompts as guidance for questions when present. Convert reflection activities into objectively answerable questions supported by the lesson; never grade personal opinions as facts.",
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw Error(data.message || "Practice Quiz generation failed.");
    const questions = (data.quiz?.questions || []).filter(q => String(q.question || "").trim());
    if (!questions.length) throw Error("No valid Practice Quiz questions were returned.");
    return {questions};
  } catch (error) {
    return {questions: existing, error: error.message || "Practice Quiz generation failed."};
  }
}
