import assert from "node:assert/strict";
import test from "node:test";
import { waitForPractice } from "../../src/services/practicePreparation.js";
import {
  coursePracticeModule,
  legacyPracticeRedirect,
} from "../../src/pages/quizzes/inQuiz/practiceSession.js";

const attempt = {
  id: 11,
  total: 10,
  questions: Array.from({ length: 10 }, (_, id) => ({ id })),
};

test("practice waits for the same background job until all ten questions are ready", async () => {
  const calls = [],
    progress = [];
  const responses = [
    { job: { id: "job-1", status: "queued" } },
    { job: { id: "job-1", status: "running" } },
    { job: { id: "job-1", status: "ready", attempt } },
  ];
  const result = await waitForPractice(
    async (action, body) => {
      calls.push([action, body]);
      return responses.shift();
    },
    { moduleId: "database" },
    { wait: async () => {}, onProgress: (status) => progress.push(status) },
  );
  assert.equal(result, attempt);
  assert.deepEqual(calls, [
    ["start", { moduleId: "database" }],
    ["jobs/job-1", undefined],
    ["jobs/job-1", undefined],
  ]);
  assert.deepEqual(progress, ["queued", "running"]);
});

test("partial sets, failed jobs and gateway errors never become five-question practice", async () => {
  for (const response of [
    {
      attempt: {
        ...attempt,
        total: 5,
        questions: attempt.questions.slice(0, 5),
      },
    },
    {
      job: {
        id: "j",
        status: "ready",
        attempt: { ...attempt, questions: attempt.questions.slice(0, 5) },
      },
    },
    {
      job: {
        id: "j",
        status: "failed",
        error: { message: "Finish Quick Recap", code: "QUICK_RECAP_REQUIRED" },
      },
    },
  ])
    await assert.rejects(waitForPractice(async () => response, {}));
  await assert.rejects(
    waitForPractice(async () => {
      throw new Error("504 Gateway Timeout");
    }, {}),
    /504/,
  );
});

test("leaving practice cancels progress checking without cancelling the server job", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(
    waitForPractice(
      async () => {
        calls++;
        controller.abort();
        return { job: { id: "j", status: "running" } };
      },
      {},
      { signal: controller.signal },
    ),
    { name: "AbortError" },
  );
  assert.equal(calls, 1);
});

test("a stalled status request times out without restarting preparation", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const calls = [];
  let entered;
  const reading = new Promise((resolve) => {
    entered = resolve;
  });
  const pending = waitForPractice(
    async (action, body, { signal }) => {
      calls.push(action);
      if (action === "start") return { job: { id: "j", status: "queued" } };
      entered();
      return new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        }),
      );
    },
    {},
    { wait: async () => {} },
  );
  await reading;
  context.mock.timers.tick(150_000);
  await assert.rejects(pending, /timed out/);
  assert.deepEqual(calls, ["start", "jobs/j"]);
});

test("old course and module player URLs redirect to adaptive practice; main quizzes and decks keep their routes", () => {
  const scope = { courseId: 20, scopeId: "database", scopeType: "module" };
  assert.equal(
    legacyPracticeRedirect(
      "/multiple-choice/lesson/20-database",
      scope,
      "20-database",
    ),
    "/student/enrolled-courses/20/practice/database?mode=multiple",
  );
  assert.equal(
    legacyPracticeRedirect(
      "/QandA-tutorial/lesson/20-all-modules",
      { ...scope, scopeType: "course" },
      "20-all-modules",
    ),
    "/student/enrolled-courses/20/practice/all-modules?mode=qna",
  );
  assert.equal(
    legacyPracticeRedirect(
      "/random-modes/lesson/20-database",
      { ...scope, scopeType: "main_quiz" },
      "20-database",
    ),
    "",
  );
  assert.equal(
    legacyPracticeRedirect("/multiple-choice/deck/20", scope, "20"),
    "",
  );
  assert.equal(
    legacyPracticeRedirect(
      "/multiple-choice/lesson/other",
      scope,
      "20-database",
    ),
    "",
  );
});

test("Practice All includes only published module content", () => {
  const course = coursePracticeModule({ title: "Information Management" }, [
    {
      studentPublished: true,
      lessonPages: [{ content: "Published" }],
      quizItems: [{ question: "Published?" }],
    },
    {
      studentPublished: false,
      lessonPages: [{ content: "Hidden" }],
      quizItems: [{ question: "Hidden?" }],
    },
  ]);
  assert.equal(course.id, "all-modules");
  assert.deepEqual(course.lessonPages, [{ content: "Published" }]);
  assert.deepEqual(course.quizItems, [{ question: "Published?" }]);
});
