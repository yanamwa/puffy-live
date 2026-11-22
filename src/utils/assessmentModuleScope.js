export function assessmentModules(course) {
  const value =
    course?.contentModules ??
    course?.content_modules ??
    course?.learningModules ??
    course?.learning_modules ??
    [];
  try {
    const modules = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(modules) ? modules : [];
  } catch {
    return [];
  }
}

export function filterModuleAttempts(
  attempts,
  moduleIndex = "all",
  modules = [],
) {
  if (moduleIndex === "all") return attempts;
  const selected = Number(moduleIndex);
  const module = modules[selected];
  if (!module || !Number.isInteger(selected)) return [];
  return attempts.filter((attempt) => matchesModule(attempt, module, selected));
}

function matchesModule(attempt, module, moduleIndex) {
  const index = attempt.module_index ?? attempt.moduleIndex;
  if (index != null && index !== "") return Number(index) === moduleIndex;
  // Older lesson-linked attempts can be scoped only by a known lesson ID.
  const lesson = attempt.lesson_id ?? attempt.lessonId;
  const moduleLesson = module.lesson_id ?? module.lessonId;
  return lesson != null && moduleLesson != null && String(lesson) === String(moduleLesson);
}

export function attemptModuleIndex(attempt, modules) {
  return modules.findIndex((module, index) => matchesModule(attempt, module, index));
}

export function assessmentModuleTitle(modules, index) {
  return modules[index]?.title?.trim() || (modules[index] ? `Module ${index + 1}` : "Module unavailable");
}

export function attemptModuleTitle(attempt, modules) {
  return assessmentModuleTitle(modules, attemptModuleIndex(attempt, modules));
}
