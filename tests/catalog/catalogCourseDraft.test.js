import test from "node:test";
import assert from "node:assert/strict";
import { applyCatalogToDraft } from "../../src/services/catalogCourseDraft.js";

const course = {
  catalog_id: 4,
  code: "GNED 05",
  title: "Purposive Communication",
  description: "Official description",
  versions: [
    {
      version_id: 7,
      coverage_modules: JSON.stringify([
        { title: "Communication Process and Its Components" },
        { title: "Local and Global Communication" },
        { title: "Orientation" },
      ]),
    },
  ],
};
let next = 0;
const id = () => `module-test-${++next}`;
test("catalog selection creates independent empty module shells from reviewed syllabus coverage", () => {
  const first = applyCatalogToDraft({ contentModules: [] }, course, id);
  const second = applyCatalogToDraft({ contentModules: [] }, course, id);
  assert.deepEqual(
    first.contentModules.map((m) => m.title),
    [
      "Communication Process and Its Components",
      "Local and Global Communication",
    ],
  );
  assert.notEqual(first.contentModules[0].id, second.contentModules[0].id);
  assert.equal(first.syllabusVersionId, 7);
  for (const module of first.contentModules) {
    assert.deepEqual(module.lessonPages, []);
    assert.deepEqual(module.quizItems, []);
    assert.equal(module.mainQuizSettings.enabled, false);
  }
  assert.equal(applyCatalogToDraft(first, course, id).contentModules.length, 2);
});
test("existing saved classes and professor content are preserved", () => {
  const saved = {
    id: 10,
    contentModules: [
      {
        id: "old",
        title: "Existing module",
        lessonPages: [{ content: "Saved lesson" }],
      },
    ],
  };
  assert.equal(applyCatalogToDraft(saved, course, id), saved);
  const manual = {
    contentModules: [
      {
        id: "manual",
        title: "Professor module",
        lessonPages: [{ content: "Own lesson" }],
      },
    ],
  };
  const selected = applyCatalogToDraft(manual, course, id);
  assert.equal(selected.contentModules[0], manual.contentModules[0]);
  assert.equal(selected.contentModules.length, 3);
});
test("switching unsaved courses replaces untouched shells and retains edited content", () => {
  const first = applyCatalogToDraft({ contentModules: [] }, course, id);
  first.contentModules[0].lessonPages.push({ title: "Professor lesson" });
  const other = {
    ...course,
    catalog_id: 9,
    versions: [
      { version_id: 12, coverage_modules: [{ title: "New syllabus module" }] },
    ],
  };
  const switched = applyCatalogToDraft(first, other, id);
  assert.deepEqual(
    switched.contentModules.map((m) => m.title),
    ["Communication Process and Its Components", "New syllabus module"],
  );
  assert.equal(switched.contentModules[0], first.contentModules[0]);
});
test("empty and missing syllabus coverage does not invent modules or overwrite intentional deletions", () => {
  const empty = applyCatalogToDraft(
    { contentModules: [] },
    { ...course, versions: [] },
    id,
  );
  assert.deepEqual(empty.contentModules, []);
  const seeded = applyCatalogToDraft({ contentModules: [] }, course, id);
  seeded.contentModules = [];
  assert.deepEqual(applyCatalogToDraft(seeded, course, id).contentModules, []);
});
test("generated catalog lessons become independent unpublished professor drafts", () => {
 const generated = {...course, versions:[{version_id:20,coverage_modules:[{
  title:"Programming",learning_objectives:"Explain variables",topics:["Variables"],
  lesson_pages:[{title:"Variables",content:"Draft lesson"}],generated_draft:true,
 }]}]};
 const first=applyCatalogToDraft({},generated,id);
 const second=applyCatalogToDraft({},generated,id);
 assert.equal(first.contentModules[0].studentPublished,false);
 assert.equal(first.contentModules[0].lessonPages[0].content,"Draft lesson");
 first.contentModules[0].lessonPages[0].content="Professor edit";
 assert.equal(second.contentModules[0].lessonPages[0].content,"Draft lesson");
 assert.equal(generated.versions[0].coverage_modules[0].lesson_pages[0].content,"Draft lesson");
});

 test("catalog Practice Quiz questions are copied separately and inline activities removed", () => {
 const draft = applyCatalogToDraft({contentModules:[]},{catalog_id:9,code:"GNED08",title:"Self",versions:[{version_id:99,coverage_modules:[{title:"Identity",lesson_pages:[{title:"Self",content:"Identity explained.\n\n**Practice Activity:** Reflect on your identity."}],quiz_items:[{question:"What is identity?",correct_answer:"Self",options:["Self","Other","None","All"]}]}]}]},()=>"new-id");
 assert.equal(draft.contentModules[0].quizItems.length,1);
 assert.equal(draft.contentModules[0].lessonPages[0].content,"Identity explained.");
 });
