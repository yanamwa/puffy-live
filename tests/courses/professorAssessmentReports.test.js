import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { transformSync } from "esbuild";
import { practiceModuleRows, summarizeEnrollmentPractice } from "../../src/utils/assessmentAnalytics.js";
import { assessmentModules, assessmentModuleTitle } from "../../src/utils/assessmentModuleScope.js";

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
const roster = {
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
const modules = [{ title: "Identity" }, { title: "Culture" }];
const fiveAttempts = [0, 4, 9, 8, 9].map((score, index) => ({
  user_id: 1, attempts_id: index + 1, module_index: 0, assessment_type: "practice",
  created_at: `2026-11-${20 + index}T10:00:00Z`, score, total: 10,
}));
const courseAttempts = [
  ...fiveAttempts,
  { user_id: 1, assessment_type: "main", score: 1, total: 2,
    answers: [{ question: "Q1", topic: "Identity", isCorrect: false }] },
  { user_id: 1, assessment_type: "recap", score: 1, total: 1,
    answers: [{ question: "Q2", topic: "Culture", isCorrect: true }] },
  { user_id: 1, assessment_type: "practice", score: null, total: 10 },
  { user_id: 1, assessment_type: "practice", score: 5, total: 0 },
];
const report = {
  ...roster,
  students: [
    summarizeEnrollmentPractice(roster.students[0], courseAttempts, modules),
    summarizeEnrollmentPractice(roster.students[1], [], []),
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
    assessmentModuleTitle,
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
    historyTable: renderer(context.PracticeAttemptsTable),
    historyTableType: context.PracticeAttemptsTable,
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
  assert.deepEqual(Array.from(tables[0].props.columns),
    ["Student", "Course", "Module", "Attempts", "Average Score", "Modules Completed", "Least Mastered", "Action"]);
  assert.equal(tables[0].props.rows.length, 2);
  assert.equal(
    text(tables[0].props.rows[0].cells),
    "DianaUnderstanding the SelfIdentity560%1/3Identity (0%)View",
  );
  assert.match(text(tables[0].props.rows[1].cells), /0Not assessed0\/2No topic results/);
  const performanceTable = h.table.render(tables[0].props);
  const firstRow = nodes(
    performanceTable,
    (node) => node.type === "tr" && node.props.onClick,
  )[0];
  firstRow.props.onClick();
  const dialog = nodes(h.root.render(), (node) => node.type === "dialog")[0];
  assert.match(text(dialog), /Diana.*Course topic mastery.*Identity \(0%\)/);
  assert.match(text(dialog), /CourseUnderstanding the SelfProgramBSITYear & Section4A/);
  assert.match(text(dialog), /ModuleIdentityAttempts5Average score60%/);
  const history = nodes(dialog, (node) => node.type === h.historyTableType)[0];
  assert.deepEqual(Array.from(history.props.attempts, (entry) => entry.id), [5, 4, 3, 2, 1]);
  dialog.props.onClose();
  assert.equal(tables[1].props.rows.length, 1);
  assert.equal(
    text(tables[1].props.rows[0].cells),
    "DianaUnderstanding the Self60%5",
  );
  nodes(
    tree,
    (node) => node.props?.["aria-label"] === "Search students, courses or modules",
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

test("module filters, sorting and View use the same student's module-specific attempts", () => {
  const h = harness();
  const modules = [{ title: "SQL" }, { title: "Database Design", lesson_id: 22 }];
  const scores = [8, 4, 9, 8, 9];
  const attempts = scores.map((score, i) => ({
    attempts_id: i + 1, user_id: 1, student_name: "Test Student", module_index: 0,
    assessment_type: "practice",
    created_at: `2026-11-20T10:${String(i * 10).padStart(2, "0")}:00Z`, score, total: 10,
  }));
  const students = practiceModuleRows([
    ...attempts,
    { ...attempts[0], attempts_id: 6, module_index: null, lesson_id: 22, score: 0 },
    { ...attempts[0], attempts_id: 7, user_id: 2, student_name: "Another Student" },
    { ...attempts[0], score: null },
    { ...attempts[0], total: 0 },
    { ...attempts[0], assessment_type: "main" },
    { ...attempts[0], assessment_type: "recap" },
  ], modules, "Databases").map((row) => ({
    ...row, year: row.id === "1" ? "2" : "1", section: row.id === "1" ? "A" : "B",
  }));
  const props = {
    title: "Student Practice Performance", students, years: ["1", "2"], sections: ["A", "B"], modules,
  };
  const render = () => h.practiceReport.render(props);
  const table = () => nodes(render(), (node) => node.type === h.tableType)[0].props;
  const select = (label, value) => {
    const field = nodes(render(), (n) => n.type === "label" && text(n).startsWith(label))[0];
    nodes(field, (n) => n.type === "select")[0].props.onChange({ target: { value } });
  };
  assert.deepEqual(Array.from(table().columns), ["Student", "Modules", "Practice Attempts", "Average Score", "Action"]);
  assert.equal(table().rows.length, 3);
  assert.match(text(table().rows[0].cells), /Test StudentSQL576%/);
  select("Sort by", "title");
  assert.match(text(table().rows[0].cells), /Database Design10%/);
  select("Sort by", "module");
  assert.match(text(table().rows[0].cells), /SQL/);
  select("Module", "0");
  select("Year Level", "2");
  select("Section", "A");
  assert.equal(table().rows.length, 1);
  const view = button(h.table.render(table()), "View");
  assert.equal(view.props["aria-label"], "View practice attempts for Test Student, SQL");
  view.props.onClick();
  const history = nodes(render(), (node) => node.type === h.historyType)[0];
  const dialog = h.history.render(history.props);
  assert.equal(dialog.props.heading, "Test Student");
  assert.equal(dialog.props.description, "SQL");
  assert.equal(nodes(dialog, (node) => node.type === "select").length, 0);
  assert.match(text(dialog), /Practice attempts5Average score76%/);
  const entries = h.historyTable.render(dialog.props);
  assert.deepEqual(nodes(entries, (node) => node.type === "time").map((node) => node.props.dateTime),
    attempts.toReversed().map((row) => new Date(row.created_at).toISOString()));
  assert.match(text(entries), /59\/10 \(90%\)/);
  dialog.props.onClose();
  assert.equal(nodes(render(), (node) => node.type === h.historyType).length, 0);
  select("Module", "all");
  nodes(render(), (n) => n.type === "input")[0].props.onChange({ target: { value: " design " } });
  assert.equal(table().rows.length, 1);
  assert.match(text(table().rows[0].cells), /Database Design10%/);
  const scoped = h.practiceReport.render({ ...props, moduleScope: "0" });
  assert.equal(nodes(scoped, (node) => node.type === h.tableType)[0].props.rows.length, 0);
});

test("course-only recorded scores are excluded and submitted practice history stays available", () => {
  const h = harness();
  const modules = [{ title: "SQL" }, { title: "Storage" }];
  const attempts = Array.from({ length: 7 }, (_, i) => ({
    attempts_id: i + 1, user_id: 1, student_name: "Test Student", assessment_type: "practice",
    score: i, total: 10, created_at: null, module_index: 0,
  }));
  const record = {
    userId: 1, name: "Test Student", recordedScoreEntries: 1, recordedAverageScore: 80,
    recordedHistory: [{ quizNumber: 4, score: 8, total: 10, proposedDisplayAt: null }],
  };
  const students = practiceModuleRows(attempts, modules, "Databases", [
    record, { ...record, userId: 2, name: "Older Student", recordedHistory: [] },
  ]);
  assert.deepEqual(students.map((s) => [s.moduleIndex, s.attempts, s.average]), [[0, 7, 30]]);
  const props = { students, title: "Student Practice Performance", modules, years: [], sections: [] };
  const tree = h.practiceReport.render(props);
  const table = nodes(tree, (node) => node.type === h.tableType)[0].props;
  assert.deepEqual(Array.from(table.rows, (row) => row.key), ["submitted:1:0"]);
  const view = table.rows[0].cells.at(-1);
  view.props.onClick();
  const selected = nodes(h.practiceReport.render(props), (node) => node.type === h.historyType)[0];
  const dialog = h.history.render(selected.props);
  assert.equal(dialog.props.description, "SQL");
  assert.match(text(dialog), /Practice attempts7Average score30%/);
  let entries = h.historyTable.render(dialog.props);
  nodes(entries, (node) => node.type === "ResultsPagination")[0].props.onPageChange(2);
  entries = h.historyTable.render(dialog.props);
  assert.match(text(entries), /Showing 6–7 of 7 attempts/);
  assert.match(text(entries), /10\/10 \(0%\)Unavailable/);
  const scoped = h.practiceReport.render({ ...props, moduleScope: "0" });
  assert.deepEqual(Array.from(nodes(scoped, (n) => n.type === h.tableType)[0].props.rows, (r) => r.key), ["submitted:1:0"]);
});

test("assessment uses fresh Practice histories once per course, including enrollments with a zero summary", async () => {
  const requests = [];
  const extraModule = { ...fiveAttempts[0], attempts_id: 6, module_index: 1, score: 10 };
  const otherStudent = { ...fiveAttempts[0], attempts_id: 7, user_id: 2, score: 7 };
  const enrollments = [
    { ...roster.students[0], scoredAttempts: 0, recordedScoreEntries: 5 },
    { ...roster.students[1], key: "42:2" },
    { ...roster.students[0], key: "43:1" },
    { ...roster.students[0], key: "44:1" },
    { ...roster.students[0], key: "43:3", recordedScoreEntries: 5 },
  ];
  const context = vm.createContext({
    API_BASE: "/api",
    assessmentModules,
    summarizeEnrollmentPractice,
    localStorage: {
      getItem: (key) => (key === "puffy-token" ? "test-token" : null),
    },
    sessionStorage: { getItem: () => null },
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      if (url.endsWith("/44")) throw new Error("Course history unavailable");
      const payload = url.endsWith("/assessments") ? { ...roster, students: enrollments }
        : { attempts: url.endsWith("/42") ? [...courseAttempts, extraModule, otherStudent] : [fiveAttempts[0]] };
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
  const result = await context.fetchSummary({
    signal: controller.signal,
    courses: [{ id: 42, raw: { contentModules: modules } }, { id: 43, raw: { contentModules: [{ title: "History" }] } }],
  });
  assert.equal(requests[0].url, "/api/reports/professor/assessments");
  assert.equal(requests[0].headers.Authorization, "Bearer test-token");
  assert.equal(requests[0].cache, "no-store");
  assert.equal(requests[0].signal, controller.signal);
  assert.deepEqual(requests.slice(1).map((request) => request.url),
    [42, 43, 44].map((id) => `/api/assessment-attempts/${id}`));
  assert.ok(requests.every((request) => request.signal === controller.signal));
  const [first, classmate, anotherCourse, unavailable, noSubmissions] = result.students;
  const practiceAnalysis = practiceModuleRows([...courseAttempts, extraModule], modules, first.course);
  assert.deepEqual(first.practiceRows, practiceAnalysis);
  assert.deepEqual(first.practiceRows.map((row) => [row.moduleTitle, row.attempts, row.average]),
    [["Identity", 5, 60], ["Culture", 1, 100]]);
  assert.equal(first.practiceAttempts.length, 6);
  assert.equal(first.topics[0].label, "Identity");
  assert.equal(classmate.practiceRows[0].attempts, 1);
  assert.equal(classmate.practiceRows[0].average, 70);
  assert.equal(anotherCourse.practiceRows[0].moduleTitle, "History");
  assert.equal(anotherCourse.practiceAverage, 0);
  assert.equal(unavailable.practiceRows[0].attempts, null);
  assert.equal(unavailable.practiceAverage, null);
  assert.equal(noSubmissions.practiceRows[0].attempts, 0);
  assert.equal(noSubmissions.practiceAverage, null);
});
