import assert from "node:assert/strict";
import { ensureGenerationCourse } from "../../src/services/generationCourseDraft.js";
const module = {
  id: "module-a",
  title: "Ethics",
  lessonPages: [],
  quizItems: [],
};
const course = {
  id: "local-draft",
  title: "Computer Ethics",
  code: "ETHICS",
  status: "published",
  visibility: "public",
  contentModules: [module],
};
const holder = { current: null };
let writes = 0;
const save = async (payload, options) => {
  writes++;
  assert.equal(payload.status, "draft");
  assert.equal(payload.visibility, "private");
  assert.equal(payload.id, undefined);
  assert.equal(payload.course_id, undefined);
  assert.equal(options.fallback, false);
  return { id: 42, code: payload.code };
};
const [first, concurrent] = await Promise.all([
  ensureGenerationCourse(course, undefined, holder, save),
  ensureGenerationCourse(course, undefined, holder, save),
]);
assert.equal(writes, 1);
assert.equal(first.id, 42);
assert.equal(concurrent.id, 42);
assert.equal(first.contentModules, course.contentModules);
const retry = await ensureGenerationCourse(
  { ...course, title: "Updated title" },
  undefined,
  holder,
  save,
);
assert.equal(writes, 1);
assert.equal(retry.id, 42);
assert.equal(retry.title, "Updated title");
const existing = await ensureGenerationCourse(
  { ...course, id: 19 },
  19,
  { current: null },
  save,
);
assert.equal(writes, 1);
assert.equal(existing.status, "published");
assert.equal(existing.visibility, "public");
const failed = { current: null };
await assert.rejects(
  () =>
    ensureGenerationCourse(course, undefined, failed, async () => {
      throw Error("Server unavailable");
    }),
  /Server unavailable/,
);
assert.equal(failed.current, null);
await assert.rejects(
  () =>
    ensureGenerationCourse(course, undefined, failed, async () => ({
      id: "local-123",
    })),
  /server/,
);
assert.equal(failed.current, null);
const untitled = await ensureGenerationCourse(
  { ...course, title: "" },
  undefined,
  { current: null },
  async (payload) => {
    assert.equal(payload.title, "Untitled course");
    return { id: 43, code: "AUTO" };
  },
);
assert.equal(untitled.title, "Untitled course");
console.log(
  "Generation draft checks passed: private drafts, existing courses, concurrent requests, retries, input preservation, and server failures.",
);
