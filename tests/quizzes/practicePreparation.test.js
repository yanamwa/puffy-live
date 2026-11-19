import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
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

test("the mode picker resolves all six modes from the saved route or configured kind", async () => {
  const { outputFiles } = await build({
    entryPoints: ["src/services/quizModeApi.js"],
    bundle: true,
    write: false,
    format: "esm",
    define: { "import.meta.env": "{}" },
  });
  const { normalizeQuizMode, quizModeSeeds } = await import(
    `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
  );
  for (const { id, kind, route } of quizModeSeeds) {
    assert.equal(normalizeQuizMode({ id, title: "Quick review", route }).kind, kind);
    assert.equal(normalizeQuizMode({ id, title: "Quick review", kind }).kind, kind);
  }
  assert.equal(normalizeQuizMode({ title: "MATCHING" }).kind, "matching");
  assert.equal(normalizeQuizMode({ title: "Survival" }).kind, "mixed");
});

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

test("a terminal 422 stops polling and keeps the server's explanation for the practice page", async () => {
  const actions = [];
  const delays = [];
  const message = "A generated question repeated an earlier question.";
  await assert.rejects(
    waitForPractice(
      async (action) => {
        actions.push(action);
        assert.ok(actions.length <= 8, "failed jobs must not be polled again");
        return {
          job:
            actions.length < 8
              ? { id: "job", status: "running" }
              : {
                  id: "job",
                  status: "failed",
                  error: {
                    status: 422,
                    code: "PRACTICE_VALIDATION_FAILED",
                    message,
                  },
                },
        };
      },
      { courseId: 17, mode: "multiple" },
      {
        wait: async (ms) => {
          delays.push(ms);
        },
      },
    ),
    {
      message,
      code: "PRACTICE_VALIDATION_FAILED",
      status: 422,
    },
  );
  assert.deepEqual(delays, [2000, 3000, 4000, 5000, 6000, 6000, 6000]);
  assert.deepEqual(actions, ["start", ...Array(7).fill("jobs/job")]);
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

test("old practice links keep each selected mode and the course and module in the URL", () => {
  const staleScope = { scopeType: "main_quiz", courseId: 88, scopeId: "another-module" };
  const tutorials = {
    flashcard: "flashcards-tutorial",
    qna: "QandA-tutorial",
    multiple: "multipleChoice-tutorial",
    matching: "Matching-tutorial",
    timed: "timedquiz-tutorial",
    mixed: "random-modes-tutorial",
  };
  for (const moduleId of ["database", "all-modules"]) {
    const legacy = `/student/enrolled-courses/17/quiz/practice/${moduleId}`;
    const practice = `/student/enrolled-courses/17/practice/${moduleId}`;
    assert.equal(legacyPracticeRedirect(legacy, staleScope, null), practice);
    for (const [mode, tutorial] of Object.entries(tutorials)) {
      const search = `?mode=${mode}`;
      assert.equal(legacyPracticeRedirect(legacy, staleScope, null, search), practice + search);
      const lessonId = `17-${moduleId}`;
      const scope = { courseId: 17, scopeId: moduleId, scopeType: moduleId === "all-modules" ? "course" : "module" };
      assert.equal(legacyPracticeRedirect(`/${tutorial}/lesson/${lessonId}`, scope, lessonId), practice + search);
    }
  }
  assert.equal(legacyPracticeRedirect("/student/enrolled-courses/17/quiz/main/database", staleScope), "");
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
