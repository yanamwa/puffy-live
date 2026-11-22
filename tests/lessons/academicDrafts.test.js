import test from "node:test";
import assert from "node:assert/strict";
import { organizedLessonDraft } from "../../src/services/organizedLessonDraft.js";
import { readMainQuizTos } from "../../src/services/mainQuizTosEditor.js";
import { applyCatalogToDraft } from "../../src/services/catalogCourseDraft.js";

test("two syllabus units sharing a title retain their own topics and pinned version when copied to the professor's course", () => {
  let id = 0;
  const version = {
    version_id: 3,
    coverage_modules: ["Rows", "Keys"].map((topic, i) => ({
      title: "Models",
      syllabus_module_index: i,
      topics: [topic],
    })),
  };
  const draft = applyCatalogToDraft(
    { contentModules: [] },
    { catalog_id: 1, title: "Data", versions: [version] },
    () => String(++id),
  );
  assert.deepEqual(
    draft.contentModules.map((m) => [
      m.syllabusModuleIndex,
      m.topics[0],
      m.catalogSyllabusVersionId,
    ]),
    [
      [0, "Rows", 3],
      [1, "Keys", 3],
    ],
  );
});

test("organizing adds reviewed pages to the draft and preserves professor edits, quiz settings and reference provenance", () => {
  const existing = {
    id: "a",
    title: "Professor's title",
    content: "Edited by the professor.",
  };
  const current = {
    title: "Professor's module",
    description: "My description",
    learningObjectives: "My objective",
    lessonPages: [existing, { title: "", content: "" }],
    quizItems: [{ question: "Existing quiz question?" }],
    mainQuizSettings: { enabled: false },
    studentPublished: true,
  };
  const coverage = {
    missing_topics: ["Keys"],
    consulted_sources: ["Handout.txt"],
    syllabus_references: [
      { category: "Textbook", entries: [{ text: "N/A", source_page: 3 }] },
    ],
  };
  const page = {
    id: "b",
    title: "New page",
    content: "Supported by the handout.",
  };
  const result = organizedLessonDraft(
    current,
    { module_title: "Replacement", source_coverage: coverage },
    [page],
  );
  assert.deepEqual(result.lessonPages, [existing, page]);
  assert.equal(result.title, current.title);
  assert.equal(result.description, current.description);
  assert.equal(result.learningObjectives, current.learningObjectives);
  assert.deepEqual(result.quizItems, current.quizItems);
  assert.deepEqual(result.mainQuizSettings, current.mainQuizSettings);
  assert.equal(result.sourceCoverage, coverage);
  assert.equal(result.studentPublished, false);
  assert.equal(current.studentPublished, true);
  assert.equal(current.lessonPages.length, 2);
});

test("the Main Quiz form expands TOS rows to exact type counts and rejects incomplete or fractional allocations", () => {
  const counts = { multiple_choice: 10, identification: 5, true_false: 5 };
  const popup = (values) => ({
    querySelectorAll: () =>
      values.map(([type, count]) => ({
        querySelectorAll: () =>
          Object.entries({
            topic: "Tables",
            type,
            cognitive_level: "Analyze",
            learning_objective: "Interpret tables.",
            count: String(count),
          }).map(([field, value]) => ({ dataset: { field }, value })),
      })),
  });
  const slots = readMainQuizTos(popup(Object.entries(counts)), counts);
  assert.equal(slots.length, 20);
  assert.equal(slots[19].type, "true_false");
  assert.equal(slots[0].cognitive_level, "Analyze");
  assert.equal(readMainQuizTos(popup([]), counts), undefined);
  assert.throws(
    () => readMainQuizTos(popup([["identification", 20]]), counts),
    /number of questions of each type/,
  );
  assert.throws(
    () => readMainQuizTos(popup([["identification", 1.5]]), counts),
    /whole question count/,
  );
});
