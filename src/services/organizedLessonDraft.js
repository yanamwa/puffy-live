export function organizedLessonDraft(current, result, pages) {
  const existing = (current.lessonPages || []).filter(
    (page) => page.title?.trim() || page.content?.trim(),
  );
  return {
    ...current,
    title: current.title || String(result.module_title || "").slice(0, 100),
    description:
      current.description || String(result.description || "").slice(0, 750),
    learningObjectives:
      current.learningObjectives ||
      String(result.learning_objectives || "").slice(0, 750),
    studentPublished: false,
    lessonPages: [...existing, ...pages],
    sourceCoverage: result.source_coverage,
  };
}
