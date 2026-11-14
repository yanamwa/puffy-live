import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { transformSync } from "esbuild";
import { readMainQuizResponseAnswer } from "../../src/services/mainQuizResponse.js";

const source = readFileSync(
  new URL(
    "../../src/pages/professor/analysis/MainQuizResponses.jsx",
    import.meta.url,
  ),
  "utf8",
);
const styles = readFileSync(
  new URL(
    "../../src/pages/professor/analysis/MainQuizResponses.css",
    import.meta.url,
  ),
  "utf8",
);
const compiled = transformSync(
  source
    .replace(/^import[\s\S]*?;\r?\n/gm, "")
    .replace("export default ", ""),
  { loader: "jsx", jsxFactory: "h", jsxFragment: "Fragment" },
).code;

function createResponses() {
  let active;
  const attempts = [
    {
      id: 7,
      name: "Diana Example",
      yearLevel: "3rd Year",
      section: "3A",
      email: "diana@example.test",
      earnedScore: 3,
      total: 5,
      answers: [
        {
          question: "Which answer is correct?",
          selected: "The correct answer",
          correct_answer: "The correct answer",
          is_correct: true,
        },
      ],
    },
  ];
  const context = vm.createContext({
    API_BASE: "/api",
    FiArrowLeft: "arrow-left",
    FiChevronLeft: "chevron-left",
    FiChevronRight: "chevron-right",
    FiMail: "mail",
    FiDownload: "download",
    Fragment: "fragment",
    Swal: {},
    h: (type, props, ...children) => ({
      type,
      props: { ...props, children: children.length === 1 ? children[0] : children },
    }),
    lessonAuthHeaders: () => ({}),
    readMainQuizResponseAnswer,
    useState(initial) {
      const index = active.cursor++;
      if (!(index in active.slots)) active.slots[index] = initial;
      return [
        active.slots[index],
        (value) => {
          active.slots[index] =
            typeof value === "function" ? value(active.slots[index]) : value;
        },
      ];
    },
  });
  vm.runInContext(compiled + ";this.Responses=MainQuizResponses;", context);
  const state = { slots: [] };
  const render = () => {
    active = state;
    state.cursor = 0;
    return context.Responses({
      courseId: "course-1",
      courseTitle: "Understanding the Self",
      quizTitle: "Main Quiz 1",
      attempts,
      passScore: 3,
      embedded: true,
    });
  };
  return { attempts, render };
}

function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((node) => nodes(node, predicate));
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

test("response print reports include student details and omit the duplicate print action", () => {
  const responses = createResponses();
  let tree = responses.render();
  const summary = nodes(
    tree,
    (node) => node.type === "table" && node.props.className === "response-summary-print",
  )[0];
  assert.ok(summary);
  assert.match(text(summary), /Diana Example3rd Year3A60%3 \/ 5Passed/);
  assert.equal(
    nodes(
      tree,
      (node) => node.type === "button" && text(node).includes("Print / Save as PDF"),
    ).length,
    0,
  );

  nodes(tree, (node) => node.type === "button" && text(node) === "View Details")[0]
    .props.onClick();
  tree = responses.render();
  const studentMeta = nodes(
    tree,
    (node) => node.type === "dl" && node.props.className === "response-print-student-meta",
  )[0];
  assert.match(text(studentMeta), /Student NameDiana ExampleYear Level3rd YearSection3AScore3 \/ 5 \(60%\)/);
  assert.match(text(tree), /Which answer is correct\?/);
  assert.match(text(tree), /Student answer: The correct answer/);
});

test("student print reports omit score breakdown and quiz details", () => {
  assert.match(
    styles,
    /\.response-detail-metrics,\s*\.response-detail-summary > h3,\s*\.response-quiz-facts\s*\{\s*display: none !important;/,
  );
});
