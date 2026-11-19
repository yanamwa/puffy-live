import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { waitForPractice } from "../../src/services/practicePreparation.js";

// Use the same component test approach as the course editor. Exercise the
// real preparation effect, polling service, mode selection and failure effect.
const file = new URL("../../src/pages/student/courses/ModulePractice.jsx", import.meta.url);
const source = readFileSync(file, "utf8").replace(/^import[\s\S]*?;\r?\n/gm, "").replace("export default ", "");
const compiled = transformSync(source, { loader: "jsx", jsxFactory: "h" }).code;
const tutorials = { flashcard: "FlashcardsTutorial", qna: "QandATutorial", multiple: "MultipleChoiceTutorial",
  matching: "MatchingTutorial", timed: "TimedTutorial", mixed: "MixedModeTutorial" };
const players = { flashcard: "Flashcards", qna: "QandA", multiple: "MultipleChoice",
  matching: "Matching", timed: "TimedQuiz", mixed: "MixedMode" };
const attempt = { id: 15, total: 10, questions: Array.from({ length: 10 }, (_, i) => ({ id: i + 1 })) };
const tick = () => new Promise((resolve) => setImmediate(resolve));

function mountPractice(mode, outcome) {
  const module = { id: "unit", title: "Unit 1" };
  const location = { pathname: "/student/enrolled-courses/20/practice/unit", search: "?mode=" + mode };
  const slots = [], effects = [], calls = [], navigations = [], messages = [];
  let cursor, advance;
  const navigate = (path, options) => { navigations.push({ path, options }); location.state = options?.state; };
  const screens = [...Object.values(tutorials), ...Object.values(players)];
  const bindings = Object.fromEntries(screens.map((name) => [name, name]));
  const statuses = ["queued", "running", outcome === "timeout" ? "running" : outcome];
  const context = vm.createContext({
    ...bindings, AbortController, console: { error() {} }, styles: {}, PracticeProgressKey: { Provider: "Provider" },
    flashcardIntro: {}, qnaIntro: {}, multipleChoiceIntro: {}, matchingIntro: {}, timedIntro: {},
    h: (type, props, ...children) => ({ type, props, children }),
    useParams: () => ({ courseId: "20", moduleId: "unit" }), useSearchParams: () => [new URLSearchParams(location.search)],
    useLocation: () => location, useNavigate: () => navigate, useMemo: (fn) => fn(),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => { slots[index] = value; }];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useEffect(fn, deps) {
      const index = cursor++;
      if (slots[index] && deps.every((value, i) => value === slots[index][i])) return;
      slots[index] = deps;
      effects.push(fn);
    },
    getStudentProgressStorageKey: () => "student", studentModuleNavigation: () => ({ moduleNumber: 1 }),
    fetchCourse: async () => ({ modules: [module] }), getCourseContentModules: (course) => course.modules,
    practiceModuleId: (value) => value.id, readModuleRecapAnswers: () => [],
    Swal: { fire: (options) => messages.push(options) },
    prepareModulePractice: (body, options) => waitForPractice(async (action) => {
      calls.push(action);
      assert.equal(body.courseId, 20);
      assert.equal(body.moduleId, "unit");
      assert.equal(body.mode, mode);
      return { success: true, job: { id: "original", status: statuses.shift(), attempt,
        error: { message: "Review rejected a question.", status: 422 } } };
    }, body, { ...options, wait: () => new Promise((resolve) => { advance = resolve; }) }),
  });
  vm.runInContext(compiled, context);
  function render() {
    cursor = 0;
    const session = context.ModulePractice();
    const view = session.type(session.props);
    for (const fn of effects.splice(0)) fn();
    return view;
  }
  return { render, advance: () => advance(), calls, navigations, messages };
}

for (const mode of Object.keys(tutorials)) {
  test(`${mode} opens its player when ready and returns once to its course on failure or timeout`, async (t) => {
    let now = 0;
    t.mock.method(Date, "now", () => now);
    for (const outcome of ["ready", "failed", "timeout"]) {
      const page = mountPractice(mode, outcome);
      page.render();
      await tick();
      page.render();
      await tick();
      assert.equal(page.render().props.status, "queued");
      page.advance();
      await tick();
      assert.equal(page.render().props.status, "running");
      if (outcome === "timeout") now += 271_000;
      page.advance();
      await tick();
      if (outcome === "ready") {
        const tutorial = page.render();
        assert.equal(tutorial.type, tutorials[mode]);
        tutorial.props.onStart();
        assert.ok(page.render().children.some((child) => child?.type === players[mode]));
        assert.equal(page.messages.length, 0);
      } else {
        assert.equal(page.render(), null);
        page.render();
        assert.equal(page.navigations.length, 1);
        assert.equal(page.navigations[0].path, "/student/enrolled-courses/20");
        assert.equal(page.navigations[0].options.replace, true);
        assert.equal(page.messages.length, 1);
        assert.equal(page.messages[0].text, outcome === "failed" ? "Review rejected a question." : "Practice preparation timed out. Please try again.");
      }
      assert.deepEqual(page.calls, ["start", "jobs/original", "jobs/original"]);
    }
  });
}
