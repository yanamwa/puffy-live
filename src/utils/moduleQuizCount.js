function parseList(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readList(...values) {
  return values.map(parseList).find((items) => items.length) || [];
}

function quizItems(content) {
  return readList(
    content?.quizItems,
    content?.quiz_items,
    content?.quizModule,
    content?.quiz_contents,
    content?.quizContent,
  ).filter((item) => String(item?.question || "").trim());
}

export function countModuleQuizzes(course) {
  const moduleSources = [
    course?.contentModules,
    course?.content_modules,
    course?.learningModules,
    course?.learning_modules,
  ];
  const modules = readList(...moduleSources);

  // Count each populated module once, regardless of its number of questions.
  // Course-wide totals can include old questions from removed modules.
  if (modules.length || moduleSources.some((value) => value != null)) {
    return modules.filter((module) => quizItems(module).length > 0).length;
  }

  const moduleKeys = quizItems(course).map((item) => {
    const index = item.moduleIndex ?? item.module_index;
    if (
      index !== undefined &&
      index !== null &&
      index !== "" &&
      Number.isInteger(Number(index)) &&
      Number(index) >= 0
    ) {
      return `index-${Number(index)}`;
    }
    const id = item.moduleId ?? item.module_id;
    if (id !== undefined && id !== null && String(id).trim()) {
      return `id-${String(id).trim()}`;
    }
    const title = String(item.moduleTitle || item.module_title || "").trim();
    return title ? `title-${title.toLowerCase()}` : null;
  });

  // Unassigned legacy questions do not establish a module quiz.
  return new Set(moduleKeys.filter(Boolean)).size;
}
