import assert from "node:assert/strict";
import test from "node:test";
import {
  getStudentSetupPath,
  getStudentSetupRedirect,
  getTutorialStep,
} from "../../src/pages/student/tutorial/studentTutorialSteps.js";

const student = {
  role: "student",
  onboardingCompleted: false,
  mustChangePassword: false,
};

test("a pending tutorial survives password recovery", () => {
  const recovered = { ...student, studentTutorialPending: true };
  assert.equal(getStudentSetupPath(recovered), "/student?tutorial=welcome");
  assert.equal(
    getStudentSetupRedirect(recovered, {
      pathname: "/student/settings",
      search: "",
    }),
    "/student?tutorial=welcome",
  );
  assert.equal(
    getStudentSetupRedirect(recovered, {
      pathname: "/student/public-courses",
      search: "?tutorial=public",
    }),
    null,
  );
});

test("a completed tutorial still sends students with temporary passwords to Settings", () => {
  const studentWithTemporaryPassword = {
    ...student,
    onboardingCompleted: true,
    studentTutorialPending: false,
    mustChangePassword: true,
  };
  assert.equal(
    getStudentSetupPath(studentWithTemporaryPassword),
    "/student/settings",
  );
});

test("the example course is part of Step 5 and other course details stay gated", () => {
  const pending = { ...student, studentTutorialPending: true };
  const example = {
    pathname: "/student/enrolled-courses/tutorial-CS101",
    search: "?tutorial=enrolled-course",
  };
  assert.equal(getTutorialStep(example).numberedStep, "enrolled");
  assert.equal(getStudentSetupRedirect(pending, example), null);
  assert.equal(
    getStudentSetupRedirect(pending, {
      ...example,
      pathname: "/student/enrolled-courses/42",
    }),
    "/student?tutorial=welcome",
  );
});

test("older profiles enter the app unless they were already flagged for setup", () => {
  assert.equal(getStudentSetupPath(student), null);
  assert.equal(
    getStudentSetupPath({ ...student, studentTutorialPending: false }),
    null,
  );
  assert.equal(
    getStudentSetupPath({ ...student, mustChangePassword: true }),
    "/student?tutorial=welcome",
  );
});
