import { removeLessonPracticeActivities } from "./lessonPracticeContent.js";
function coverageList(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Copy catalog lessons into independent, unpublished professor drafts.
export function applyCatalogToDraft(
  form,
  course,
  createId = () => crypto.randomUUID(),
) {
  if (Number(form.id) > 0 || Number(form.course_id) > 0) return form;
  const same = String(form.catalogId) === String(course.catalog_id);
  const version =
    (same &&
      course.versions?.find(
        (v) => String(v.version_id) === String(form.syllabusVersionId),
      )) ||
    course.versions?.[0];
  const modules = form.contentModules || [];
  const alreadySeeded =
    same &&
    String(form.coverageSeededVersionId) === String(version?.version_id);
  const preserved = same
    ? modules
    : modules.filter(
        (module) =>
          !module.catalogCoverageTitle ||
          module.title !== module.catalogCoverageTitle ||
          module.topics?.some(t => t.trim()) ||
          module.description ||
          module.learningObjectives ||
          module.lessonPages?.length ||
          module.quizItems?.length,
      );
  const titles = new Set(
    preserved.map((module) => module.title.trim().toLowerCase()),
  );
  const additions =
    alreadySeeded || (same && modules.length)
      ? []
      : coverageList(version?.coverage_modules).flatMap((row) => {
          const title = String(row.title || "").trim();
          if (
            !title ||
            titles.has(title.toLowerCase()) ||
            /^(?:(?:course|general|student|gad)\s+)?orientation\b/i.test(title)
          )
            return [];
          titles.add(title.toLowerCase());
          return [
            {
              id: createId(),
              title,
              catalogCoverageTitle: title,
              description: String(row.description || ""),
              learningObjectives: String(row.learning_objectives || ""),
              topics: [...(row.topics || [])],
              studentPublished: false,
              lessonPages: (row.lesson_pages || []).map(page => ({ ...page, content: removeLessonPracticeActivities(page.content), id: createId() })),
              quizItems: (row.quiz_items || []).map(item => ({ ...item, id: createId() })),
              mainQuizSettings: { enabled: false, unlockAt: "", lockAt: "" },
              mainQuizEnabled: false,
              mainQuizUnlockAt: "",
              mainQuizLockAt: "",
            },
          ];
        });
  return {
    ...form,
    catalogId: course.catalog_id,
    catalogCode: course.code,
    title: course.title,
    summary: course.description || "",
    subject: course.title,
    syllabusVersionId: version?.version_id || null,
    coverageSeededVersionId: version?.version_id || null,
    contentModules: [...preserved, ...additions],
  };
}
