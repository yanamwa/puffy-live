import assert from "node:assert/strict";
import { selectCourseBuilderDraft } from "../../src/services/courseBuilderDraft.js";
const oldCourse = {
  id: 42,
  title: "Old course",
  contentModules: [{ id: "old-module" }],
};
let reads = 0;
const readDraft = (id) => {
  reads++;
  assert.equal(id, "42");
  return oldCourse;
};
assert.equal(selectCourseBuilderDraft(undefined, null, readDraft), null);
assert.equal(
  selectCourseBuilderDraft(undefined, undefined, () => oldCourse),
  null,
);
assert.equal(reads, 0);
assert.equal(selectCourseBuilderDraft("42", null, readDraft), oldCourse);
assert.equal(reads, 1);
const inProgress = {
  title: "New course",
  contentModules: [{ id: "new-module" }],
};
assert.equal(
  selectCourseBuilderDraft(undefined, inProgress, readDraft),
  inProgress,
);
assert.equal(selectCourseBuilderDraft("42", inProgress, readDraft), inProgress);
assert.equal(reads, 1);
console.log(
  "Fresh Add Course ignores stale drafts; edit and module-return flows retain the intended course.",
);
