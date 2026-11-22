import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { transformSync } from "esbuild";
import { summarizeAssessment } from "../../src/utils/assessmentAnalytics.js";
import { attemptModuleTitle } from "../../src/utils/assessmentModuleScope.js";

const compiled = [
  "pages/professor/analysis/ProfessorStudentPerformance.jsx",
  "pages/professor/analysis/QuizAssessmentDashboard.jsx",
  "pages/professor/analysis/ProfessorPracticeHistory.jsx",
  "components/PracticeAttemptsDialog.jsx",
].map((file) => {
  const source = readFileSync(new URL(`../../src/${file}`, import.meta.url), "utf8")
    .replace(/^import[\s\S]*?;\r?\n/gm, "")
    .replace("export default ", "")
    .replace(/^export /gm, "");
  return transformSync(source, { loader: "jsx", jsxFactory: "h", jsxFragment: "Fragment" }).code;
}).join("\n");
const report = {
  passingPercentage: 70,
  students: [
    {
      key: "42:1",
      name: "Diana",
      program: "BSIT",
      yearLevel: "4th Year",
      section: "4A",
      course: "Understanding the Self",
      courseCode: "PB-SELF",
      scoredAttempts: 2,
      averageScore: 15,
      completedModules: 1,
      totalModules: 3,
      needsAttention: true,
      practiceAttempts: [{ attempts_id: 1, score: 1, total: 4 }],
      topics: [{ label: "Identity", percent: 0 }],
    },
    {
      key: "43:2",
      name: "Anya",
      course: "History",
      courseCode: "PB-HISTORY",
      scoredAttempts: 0,
      averageScore: null,
      completedModules: 0,
      totalModules: 2,
      needsAttention: false,
    },
  ],
};

function harness({ data = report, fails = false, pending = false } = {}) {
  let active;
  let resolve;
  let requestSignal;
  const request = pending
    ? new Promise((done) => {
        resolve = done;
      })
    : null;
  const context = vm.createContext({
    AbortController,
    Fragment: "fragment",
    h: (type, props, ...children) => ({ type, props: { ...props, children } }),
    styles: new Proxy({}, { get: (_, key) => key }),
    reportStyles: {},
    attemptModuleTitle,
    ResultsPagination: "ResultsPagination",
    RESULTS_PER_PAGE: 5,
    useId: () => "test-id",
    FiSearch: "search-icon",
    FiX: "close-icon",
    useState(initial) {
      const state = active;
      const index = state.cursor++;
      if (!(index in state.slots)) state.slots[index] = initial;
      return [
        state.slots[index],
        (value) => {
          state.slots[index] =
            typeof value === "function" ? value(state.slots[index]) : value;
        },
      ];
    },
    useMemo: (fn) => fn(),
    useEffect(fn, deps) {
      const index = active.effectCursor++;
      if (
        !active.deps[index] ||
        deps.some((value, i) => !Object.is(value, active.deps[index][i]))
      ) {
        active.deps[index] = deps;
        active.effects.push(fn);
      }
    },
    fetchProfessorAssessmentSummary: async ({ signal }) => {
      requestSignal = signal;
      if (fails) throw new Error("Report unavailable");
      return pending ? request : data;
    },
  });
  vm.runInContext(
    compiled +
      ";this.Report=ProfessorStudentPerformance;this.Table=AssessmentReportTable;",
    context,
  );
  function renderer(component) {
    const state = { slots: [], deps: [], effects: [], cleanups: [] };
    return {
      render(props = {}) {
        active = state;
        state.cursor = state.effectCursor = 0;
        const tree = component(props);
        state.effects.splice(0).forEach((fn) => state.cleanups.push(fn()));
        return tree;
      },
      close() {
        state.cleanups.forEach((fn) => fn?.());
      },
    };
  }
  return {
    root: renderer(context.Report),
    table: renderer(context.Table),
    tableType: context.Table,
    practiceReport: renderer(context.PracticeStudentReport),
    history: renderer(context.ProfessorPracticeHistory),
    historyTable: renderer(context.AttemptTable),
    historyType: context.ProfessorPracticeHistory,
    resolve: (value) => resolve(value),
    signal: () => requestSignal,
  };
}
function nodes(tree, predicate) {
  if (Array.isArray(tree))
    return tree.flatMap((node) => nodes(node, predicate));
  if (!tree || typeof tree !== "object") return [];
  return [
    ...(predicate(tree) ? [tree] : []),
    ...nodes(tree.props?.children, predicate),
  ];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  return tree && typeof tree === "object"
    ? text(tree.props?.children)
    : String(tree ?? "");
}
const button = (tree, label) =>
  nodes(tree, (node) => node.type === "button" && text(node) === label)[0];
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("the professor report shows both sections, real score states and searchable students", async () => {
  const h = harness();
  assert.match(text(h.root.render()), /Loading student performance/);
  await settle();
  let tree = h.root.render();
  assert.match(text(tree), /Student Performance/);
  assert.match(text(tree), /Students Needing Attention/);
  assert.match(text(tree), /configured 70% reporting threshold/);
  let tables = nodes(tree, (node) => node.type === h.tableType);
  assert.equal(tables[0].props.rows.length, 2);
  assert.equal(
    text(tables[0].props.rows[0].cells),
    "DianaUnderstanding the Self115%1/3Identity (0%)",
  );
  assert.match(text(tables[0].props.rows[1].cells), /N\/A0\/2No topic results/);
  const performanceTable = h.table.render(tables[0].props);
  const firstRow = nodes(
    performanceTable,
    (node) => node.type === "tr" && node.props.onClick,
  )[0];
  firstRow.props.onClick();
  const dialog = nodes(h.root.render(), (node) => node.type === "dialog")[0];
  assert.match(text(dialog), /Diana.*Topic mastery.*Identity \(0%\)/);
  assert.match(text(dialog), /CourseBSITYear & Section4A/);
  dialog.props.onClose();
  assert.equal(tables[1].props.rows.length, 1);
  assert.equal(
    text(tables[1].props.rows[0].cells),
    "DianaUnderstanding the Self15%1",
  );
  nodes(
    tree,
    (node) => node.props?.["aria-label"] === "Search students or courses",
  )[0].props.onChange({ target: { value: "  PB-history  " } });
  tree = h.root.render();
  tables = nodes(tree, (node) => node.type === h.tableType);
  assert.equal(tables[0].props.rows.length, 1);
  assert.match(text(tables[0].props.rows[0].cells), /^AnyaHistory/);
  assert.equal(tables[1].props.rows.length, 1);
});

test("missing thresholds, failed requests and canceled loads do not show misleading results", async () => {
  const missing = harness({
    data: {
      ...report,
      passingPercentage: null,
      students: [{ ...report.students[0], needsAttention: false }],
    },
  });
  missing.root.render();
  await settle();
  const tree = missing.root.render();
  const tables = nodes(tree, (node) => node.type === missing.tableType);
  assert.match(text(tables[0].props.rows[0].cells), /Identity \(0%\)/);
  assert.equal(tables[1].props.rows.length, 0);
  assert.match(tables[1].props.empty, /not configured/);

  const failed = harness({ fails: true });
  failed.root.render();
  await settle();
  assert.equal(failed.root.render().props.role, "alert");
  assert.match(text(failed.root.render()), /Report unavailable/);
  const canceled = harness({ pending: true });
  canceled.root.render();
  canceled.root.close();
  assert.equal(canceled.signal().aborted, true);
  canceled.resolve(report);
  await settle();
  assert.match(text(canceled.root.render()), /Loading student performance/);
});

test("numbered report pages preserve row order and reset when the search changes", () => {
  const h = harness();
  const props = {
    columns: ["Student"],
    rows: Array.from({ length: 25 }, (_, index) => ({
      key: index,
      cells: [`Student ${index + 1}`],
    })),
    empty: "No matching students.",
  };
  const visibleStudents = (tree) => nodes(tree, (node) => node.type === "td").map(text);
  let tree = h.table.render(props);
  assert.deepEqual(visibleStudents(tree), props.rows.slice(0, 10).map((row) => row.cells[0]));
  assert.equal(button(tree, "Previous").props.disabled, true);
  button(tree, "Next").props.onClick();
  tree = h.table.render(props);
  assert.deepEqual(visibleStudents(tree), props.rows.slice(10, 20).map((row) => row.cells[0]));
  button(tree, "3").props.onClick();
  tree = h.table.render(props);
  assert.deepEqual(visibleStudents(tree), props.rows.slice(20).map((row) => row.cells[0]));
  assert.equal(button(tree, "Next").props.disabled, true);
  assert.equal(
    nodes(tree, (node) => node.type === "tbody")[0].props.children[0].length,
    5,
  );
  tree = h.table.render({
    ...props,
    pageKey: "search",
    rows: props.rows.slice(0, 2),
  });
  assert.deepEqual(visibleStudents(tree), ["Student 1", "Student 2"]);
  assert.equal(button(tree, "Next").props.disabled, true);
  assert.match(
    text(h.table.render({ ...props, rows: [] })),
    /No matching students/,
  );
});

test("View opens the selected student's scored submissions with their module, dates and average", () => {
  const h = harness();
  const scores = [8, 4, 9, 8, 9];
  const attempts = scores.map((score, i) => ({
    attempts_id: i + 1, user_id: 1, student_name: "Test Student", module_index: 0,
    created_at: `2026-11-20T10:${String(i * 10).padStart(2, "0")}:00Z`, score, total: 10,
  }));
  const { students } = summarizeAssessment([...attempts, { ...attempts[0], score: null }], [], []);
  const props = {
    title: "Student Practice Performance", students, years: [], sections: [],
    courseTitle: "Information Management", historyModules: [{ title: "Introduction to Database" }],
  };
  const table = nodes(h.practiceReport.render(props), (node) => node.type === h.tableType)[0];
  const view = button(h.table.render(table.props), "View");
  assert.equal(view.props["aria-label"], "View practice history for Test Student");
  view.props.onClick();
  const history = nodes(h.practiceReport.render(props), (node) => node.type === h.historyType)[0];
  const dialog = h.history.render(history.props);
  assert.equal(dialog.props.heading, "Test Student");
  assert.equal(dialog.props.description, "Information Management");
  assert.match(text(dialog), /Scored attempts5Average score76%/);
  const entries = h.historyTable.render(dialog.props);
  assert.deepEqual(nodes(entries, (node) => node.type === "time").map((node) => node.props.dateTime),
    attempts.toReversed().map((row) => new Date(row.created_at).toISOString()));
  assert.match(text(entries), /5Introduction to Database9\/10 \(90%\)/);
  dialog.props.onClose();
  assert.equal(nodes(h.practiceReport.render(props), (node) => node.type === h.historyType).length, 0);
});

test("recorded history and submitted practice show their own scores and pagination", () => {
  const h = harness();
  const attemptHistory = Array.from({ length: 7 }, (_, i) => ({
    attempts_id: i + 1, score: i, total: 10, created_at: null, module_index: 0,
  }));
  const student = {
    name: "Test Student", attempts: 1, average: 80,
    recordedHistory: [{ quizNumber: 4, score: 8, total: 10, proposedDisplayAt: null }],
    submittedPractice: { attempts: 7, average: 30, attemptHistory },
  };
  const props = { student, courseTitle: "Databases", modules: [{ title: "SQL" }] };
  let dialog = h.history.render(props);
  assert.match(text(dialog), /Recorded scores1Average score80%/);
  assert.match(text(h.historyTable.render(dialog.props)), /EntryScoreDisplay date48\/10 \(80%\)Unavailable/);
  nodes(dialog, (node) => node.type === "select")[0].props.onChange({ target: { value: "submitted" } });
  dialog = h.history.render(props);
  assert.match(text(dialog), /Scored attempts7Average score30%/);
  let entries = h.historyTable.render(dialog.props);
  nodes(entries, (node) => node.type === "ResultsPagination")[0].props.onPageChange(2);
  entries = h.historyTable.render(dialog.props);
  assert.match(text(entries), /Showing 6–7 of 7 attempts/);
  assert.match(text(entries), /1SQL0\/10 \(0%\)Unavailable/);
  const legacy = harness();
  const summaryOnly = legacy.history.render({ ...props, student: { ...student, recordedHistory: [] } });
  assert.match(text(summaryOnly), /Scored attempts7Average score30%/);
  nodes(summaryOnly, (node) => node.type === "select")[0].props.onChange({ target: { value: "recorded" } });
  const recordedSummary = legacy.history.render({ ...props, student: { ...student, recordedHistory: [] } });
  assert.match(text(recordedSummary), /Recorded scores1Average score80%/);
  assert.match(text(legacy.historyTable.render(recordedSummary.props)), /Individual score details are unavailable/);
});

test("professor report requests include the stored session token, cancellation and fresh data", async () => {
  const requests = [];
  const context = vm.createContext({
    API_BASE: "/api",
    summarizeAssessment,
    localStorage: {
      getItem: (key) => (key === "puffy-token" ? "test-token" : null),
    },
    sessionStorage: { getItem: () => null },
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      const attempts = [
        {
          user_id: 1,
          assessment_type: "practice",
          score: 0,
          total: 1,
          answers: [{ question: "Q1", topic: "Identity", isCorrect: false }],
        },
        {
          user_id: 1,
          assessment_type: "main",
          score: 1,
          total: 1,
          answers: [{ question: "Q2", topic: "Culture", isCorrect: true }],
        },
        { user_id: 1, assessment_type: "main", score: null, total: 1 },
        { user_id: 2, assessment_type: "recap", score: 1, total: 1 },
      ];
      const payload = url.endsWith("/42") ? { attempts } : report;
      return { ok: true, json: async () => ({ success: true, ...payload }) };
    },
  });
  const api = readFileSync(
    new URL("../../src/services/reportApi.js", import.meta.url),
    "utf8",
  )
    .replace(/^import[\s\S]*?;\r?\n/gm, "")
    .replace(/^export /gm, "");
  vm.runInContext(
    api + ";this.fetchSummary=fetchProfessorAssessmentSummary;",
    context,
  );
  const controller = new AbortController();
  const result = await context.fetchSummary({ signal: controller.signal });
  assert.equal(requests[0].url, "/api/reports/professor/assessments");
  assert.equal(requests[0].headers.Authorization, "Bearer test-token");
  assert.equal(requests[0].cache, "no-store");
  assert.equal(requests[0].signal, controller.signal);
  assert.equal(requests[1].url, "/api/assessment-attempts/42");
  assert.equal(requests[1].signal, controller.signal);
  assert.equal(requests.length, 2);
  assert.equal(result.students[0].practiceAttempts.length, 1);
  assert.equal(
    result.students[0].practiceAttempts[0].assessment_type,
    "practice",
  );
  assert.equal(result.students[0].topics[0].label, "Identity");
});
