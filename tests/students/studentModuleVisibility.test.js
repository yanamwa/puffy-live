import test from "node:test";
import assert from "node:assert/strict";
import {
  studentVisibleModuleIndices,
  studentModuleNavigation,
} from "../../src/utils/studentModuleVisibility.js";
test("only uploaded modules appear without renumbering saved progress indices", () => {
  assert.deepEqual(
    studentVisibleModuleIndices([
      { studentPublished: false },
      { studentPublished: true },
      { studentPublished: false },
      { studentPublished: true },
    ]),
    [1, 3],
  );
  assert.deepEqual(
    studentVisibleModuleIndices([{ studentPublished: false }]),
    [],
  );
  assert.deepEqual(
    studentVisibleModuleIndices([{ studentPublished: true }, {}]),
    [0],
  );
});
test("legacy course visibility is preserved", () => {
  assert.deepEqual(studentVisibleModuleIndices([{}, {}]), [0, 1]);
});

test("lesson navigation skips unpublished modules and stops after the last visible module", () => {
  const modules = [
    { studentPublished: true },
    { studentPublished: false },
    { studentPublished: true },
  ];
  assert.equal(studentModuleNavigation(modules, 0).nextModuleIndex, 2);
  assert.equal(studentModuleNavigation(modules, 2).nextModuleIndex, null);
  assert.equal(studentModuleNavigation(modules, 2).moduleCount, 2);
  assert.equal(studentModuleNavigation(modules, 2).moduleNumber, 2);
  assert.equal(studentModuleNavigation(modules, 1).moduleIndex, 0);
  assert.equal(
    studentModuleNavigation(
      [{ studentPublished: true }, { studentPublished: false }],
      0,
    ).nextModuleIndex,
    null,
  );
});
