import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { transformSync } from "esbuild";

const source = readFileSync(
  new URL(
    "../../src/pages/professor/coursemanagement/CourseModuleEditor.jsx",
    import.meta.url,
  ),
  "utf8",
);
const compiled = transformSync(
  source.replace(/^import[\s\S]*?;\r?\n/gm, "").replace("export default ", ""),
  { loader: "jsx", jsxFactory: "h", jsxFragment: "Fragment" },
).code;

function editor(pageCount) {
  const slots = [];
  const refs = [];
  const dependencies = [];
  const storage = new Map();
  const lessonPages = Array.from({ length: pageCount }, (_, index) => ({
    id: `page-${index + 1}`,
    title: `Lesson page ${index + 1}`,
    content: `Content ${index + 1}`,
  }));
  const location = {
    state: {
      courseDraft: {
        id: "test-course",
        title: "Test Course",
        contentModules: [
          { id: "test-module", title: "Test Module", lessonPages },
        ],
      },
    },
  };
  let cursor = 0;
  let refCursor = 0;
  let effectCursor = 0;
  let revision = 0;
  let effects = [];
  let confirmed = true;
  const context = vm.createContext({
    Fragment: "fragment",
    h: (type, props, ...children) => ({ type, props: { ...props, children } }),
    styles: new Proxy({}, { get: (_, key) => key }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots))
        slots[index] = typeof initial === "function" ? initial() : initial;
      return [
        slots[index],
        (value) => {
          const next =
            typeof value === "function" ? value(slots[index]) : value;
          if (!Object.is(slots[index], next)) {
            slots[index] = next;
            revision += 1;
          }
        },
      ];
    },
    useRef(initial) {
      const index = refCursor++;
      return (refs[index] ||= { current: initial });
    },
    useMemo: (fn) => fn(),
    useEffect(fn, values) {
      const index = effectCursor++;
      if (
        !dependencies[index] ||
        values.some((value, i) => !Object.is(value, dependencies[index][i]))
      ) {
        dependencies[index] = values;
        effects.push(fn);
      }
    },
    useParams: () => ({ id: "test-course", moduleId: "test-module" }),
    useLocation: () => location,
    useNavigate: () => navigate,
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
    sessionStorage: { getItem: () => null, setItem() {} },
    Swal: { fire: async () => ({ isConfirmed: confirmed }) },
    LoadingState: "LoadingState",
    ManagementBackBar: "ManagementBackBar",
    LessonContentEditor: "LessonContentEditor",
    LessonSourceEvidence: "LessonSourceEvidence",
    LessonSourceManager: "LessonSourceManager",
    LessonFilePicker: "LessonFilePicker",
    removeLessonPracticeActivities: (pages) => pages,
    fetchCourse: async () => {
      throw new Error("Unexpected course request");
    },
  });
  function navigate() {
    throw new Error("Unexpected navigation");
  }
  vm.runInContext(
    compiled +
      ";this.Editor=CourseModuleEditor;this.pageNumbers=getLessonPageNumbers;",
    context,
  );

  const render = () => {
    for (let pass = 0; pass < 5; pass += 1) {
      cursor = refCursor = effectCursor = 0;
      effects = [];
      const previousRevision = revision;
      const tree = context.Editor({});
      effects.forEach((fn) => fn());
      if (revision === previousRevision) return tree;
    }
    throw new Error("Editor did not settle");
  };
  return {
    render,
    pageNumbers: context.pageNumbers,
    confirm: (value) => {
      confirmed = value;
    },
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
const pageButton = (tree, page) =>
  nodes(tree, (node) => node.props?.["aria-label"] === `Page ${page}`)[0];
const titleInput = (tree) =>
  nodes(tree, (node) => node.props?.placeholder === "Enter page title")[0];
const checkbox = (tree, label) =>
  nodes(
    nodes(tree, (node) => node.type === "label" && text(node) === label)[0],
    (node) => node.type === "input",
  )[0];

test("lesson pagination shows consecutive groups of up to ten pages", () => {
  const { pageNumbers } = editor(0);
  assert.deepEqual(Array.from(pageNumbers(0, 1)), []);
  assert.deepEqual(Array.from(pageNumbers(4, 1)), [1, 2, 3, 4]);
  assert.deepEqual(Array.from(pageNumbers(12, 10)), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(Array.from(pageNumbers(12, 11)), [11, 12]);
  assert.deepEqual(Array.from(pageNumbers(23, 21)), [21, 22, 23]);
});

test("one pager opens the chosen lesson, keeps edits, and disables boundary steps", () => {
  const h = editor(10);
  let tree = h.render();
  assert.equal(
    nodes(tree, (node) => node.props?.["aria-label"] === "Lesson pages").length,
    1,
  );
  assert.equal(
    nodes(tree, (node) => node.props?.className === "lessonPageTabs").length,
    0,
  );
  assert.equal(button(tree, "Previous").props.disabled, true);
  assert.equal(pageButton(tree, 1).props["aria-current"], "page");
  pageButton(tree, 4).props.onClick();
  tree = h.render();
  assert.equal(titleInput(tree).props.value, "Lesson page 4");
  titleInput(tree).props.onChange({ target: { value: "Updated page 4" } });
  button(tree, "Next").props.onClick();
  tree = h.render();
  assert.equal(titleInput(tree).props.value, "Lesson page 5");
  button(tree, "Previous").props.onClick();
  tree = h.render();
  assert.equal(titleInput(tree).props.value, "Updated page 4");
  pageButton(tree, 10).props.onClick();
  tree = h.render();
  assert.equal(titleInput(tree).props.value, "Lesson page 10");
  assert.equal(pageButton(tree, 10).props["aria-current"], "page");
  assert.equal(button(tree, "Next").props.disabled, true);
});

test("page selections survive navigation and deletion removes only confirmed selections", async () => {
  const h = editor(12);
  let tree = h.render();
  checkbox(tree, "Select This Page").props.onChange({
    target: { checked: true },
  });
  tree = h.render();
  pageButton(tree, 10).props.onClick();
  tree = h.render();
  button(tree, "Next").props.onClick();
  tree = h.render();
  assert.equal(pageButton(tree, 11).props["aria-current"], "page");
  assert.equal(pageButton(tree, 10), undefined);
  pageButton(tree, 12).props.onClick();
  tree = h.render();
  checkbox(tree, "Select This Page").props.onChange({
    target: { checked: true },
  });
  tree = h.render();
  const element = {};
  checkbox(tree, "Select All").props.ref(element);
  assert.equal(element.indeterminate, true);
  h.confirm(false);
  await button(tree, "Remove Selected (2)").props.onClick();
  tree = h.render();
  assert.equal(titleInput(tree).props.value, "Lesson page 12");
  assert.equal(checkbox(tree, "Select This Page").props.checked, true);
  h.confirm(true);
  await button(tree, "Remove Selected (2)").props.onClick();
  tree = h.render();
  assert.equal(titleInput(tree).props.value, "Lesson page 11");
  assert.equal(pageButton(tree, 10).props["aria-current"], "page");
  assert.equal(pageButton(tree, 12), undefined);
  assert.equal(button(tree, "Remove Selected (0)").props.disabled, true);
  assert.equal(checkbox(tree, "Select This Page").props.checked, false);
});

test("Select All includes hidden pages and the editor recovers after deleting every page", async () => {
  const h = editor(12);
  let tree = h.render();
  checkbox(tree, "Select All").props.onChange({ target: { checked: true } });
  tree = h.render();
  assert.equal(checkbox(tree, "Select This Page").props.checked, true);
  assert.ok(button(tree, "Remove Selected (12)"));
  checkbox(tree, "Select All").props.onChange({ target: { checked: false } });
  tree = h.render();
  assert.equal(button(tree, "Remove Selected (0)").props.disabled, true);
  checkbox(tree, "Select All").props.onChange({ target: { checked: true } });
  tree = h.render();
  await button(tree, "Remove Selected (12)").props.onClick();
  tree = h.render();
  assert.match(text(tree), /Add a lesson page to begin/);
  assert.equal(
    nodes(tree, (node) => node.props?.["aria-label"] === "Lesson pages").length,
    0,
  );
  button(tree, "+ Add Page").props.onClick();
  tree = h.render();
  assert.equal(titleInput(tree).props.value, "");
  assert.equal(pageButton(tree, 1).props["aria-current"], "page");
  assert.equal(button(tree, "Previous").props.disabled, true);
  assert.equal(button(tree, "Next").props.disabled, true);
  assert.equal(button(tree, "Remove Selected (0)").props.disabled, true);
});
