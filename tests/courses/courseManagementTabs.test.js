import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);

test("Course Management switches between catalog, classes and archive without rendering stale rows", async () => {
  // Execute the real page and its table markup. Keep only hook scheduling and
  // external services controlled so requests cannot overwrite the transition.
  const harness = { slots: [], cursor: 0, effects: [] };
  const previousWindow = globalThis.window;
  globalThis.__courseTabTest = harness;
  const mocks = {
    react: `export function useState(initial){const h=globalThis.__courseTabTest,i=h.cursor++;if(!(i in h.slots))h.slots[i]=typeof initial==='function'?initial():initial;return [h.slots[i],v=>{h.slots[i]=typeof v==='function'?v(h.slots[i]):v;}];} export const useEffect=fn=>globalThis.__courseTabTest.effects.push(fn);export const useCallback=fn=>fn;`,
    auth: `export const useAuth=()=>({user:{role:globalThis.__courseTabTest.role}});`,
    api: `export const catalogRequest=async()=>{throw new Error('Unexpected network request');};export const notifyCatalogChanged=()=>{};`,
    courseApi: `export const archiveCourseById=()=>{};`,
    modal: `export const CatalogModal=()=>null;export const PdfPreview=()=>null;`,
    wizard: `export default ()=>null;export const CatalogFields=()=>null;`,
    details: `export const ProfessorClassDetails=()=>null;`,
    swal: `export default {fire:()=>{}};`,
  };
  try {
    const result = await build({
      entryPoints: [
        new URL(
          "../../src/pages/admin/modules/CourseManagementPage.jsx",
          import.meta.url,
        ).pathname.replace(/^\/([A-Z]:)/i, "$1"),
      ],
      bundle: true,
      write: false,
      format: "esm",
      platform: "node",
      jsx: "automatic",
      loader: { ".css": "empty" },
      plugins: [
        {
          name: "controlled-page-dependencies",
          setup(builder) {
            builder.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({
              path: pathToFileURL(require.resolve("react/jsx-runtime")).href,
              external: true,
            }));
            builder.onResolve({ filter: /.*/ }, (args) => {
              const name = args.path;
              const key =
                name === "react"
                  ? "react"
                  : name === "sweetalert2"
                    ? "swal"
                    : name.endsWith("/AuthContext.jsx")
                      ? "auth"
                      : name.endsWith("/catalogApi.js")
                        ? "api"
                        : name.endsWith("/courseApi.js")
                          ? "courseApi"
                          : name.endsWith("/CatalogModal.jsx")
                            ? "modal"
                            : name.endsWith("/SyllabusWizard.jsx")
                              ? "wizard"
                              : name === "./ModuleManagementPage.jsx"
                                ? "details"
                                : null;
              if (key) return { path: key, namespace: "test-mock" };
            });
            builder.onLoad(
              { filter: /.*/, namespace: "test-mock" },
              (args) => ({ contents: mocks[args.path], loader: "js" }),
            );
          },
        },
      ],
    });
    const { default: Page } = await import(
      "data:text/javascript;base64," +
        Buffer.from(result.outputFiles[0].text).toString("base64")
    );
    const tree = () => {
      harness.cursor = 0;
      return Page();
    };
    const text = (node) =>
      Array.isArray(node)
        ? node.map(text).join("")
        : typeof node === "string"
          ? node
          : node?.props
            ? text(node.props.children)
            : "";
    const tabButton = (node, label) => {
      if (Array.isArray(node))
        return node.map((n) => tabButton(n, label)).find(Boolean);
      if (node?.props?.role === "tab" && text(node) === label) return node;
      return node?.props ? tabButton(node.props.children, label) : undefined;
    };
    const complete = (tab, records) => {
      const dataIndex = harness.slots.findIndex(
        (value) => value && Array.isArray(value.records),
      );
      harness.slots[dataIndex] = { tab, records, total: records.length };
      // First boolean state is the page loading flag.
      harness.slots[
        harness.slots.findIndex((value) => typeof value === "boolean")
      ] = false;
    };
    for (const role of ["admin", "super_admin"]) {
      harness.slots = [];
      harness.effects = [];
      harness.role = role;
      tree();
      const listeners = new Map();
      globalThis.window = {
        addEventListener: (name, fn) => listeners.set(name, fn),
        removeEventListener: (name) => listeners.delete(name),
      };
      const cleanup = harness.effects[0]();
      assert.equal(
        listeners.has("focus"),
        false,
        "Alt+Tab must not refresh the course list",
      );
      const before = [...harness.slots];
      listeners.get("focus")?.();
      assert.deepEqual(harness.slots, before);
      assert.equal(typeof listeners.get("puffy-catalog-updated"), "function");
      listeners.get("puffy-catalog-updated")();
      assert.notDeepEqual(
        harness.slots,
        before,
        "successful catalog changes must still invalidate data",
      );
      cleanup();
      assert.equal(listeners.size, 0);

      complete("catalog", [
        {
          catalog_id: 1,
          code: "CS 1",
          title: "Catalog course",
          programs: ["BSIT"],
          status: "active",
        },
      ]);
      assert.match(renderToStaticMarkup(tree()), /Catalog course/);
      tabButton(tree(), "Professor Classes").props.onClick();
      assert.match(renderToStaticMarkup(tree()), /Loading professor classes/);
      complete("classes", [
        {
          course_id: 10,
          code: "CLASS-JOIN",
          title: "Legacy class",
          professor: "Professor",
          student_count: 3,
          status: "draft",
        },
      ]);
      assert.match(renderToStaticMarkup(tree()), /Not linked to catalog/);
      tabButton(tree(), "Course Catalog").props.onClick();
      const switching = renderToStaticMarkup(tree());
      assert.match(switching, /Loading course records/);
      assert.doesNotMatch(switching, /Legacy class/);
      // An old response must never be rendered in a different tab's table.
      complete("classes", [{ course_id: 10, title: "Stale class" }]);
      assert.match(renderToStaticMarkup(tree()), /Loading course records/);
      tabButton(tree(), "Archived Courses").props.onClick();
      assert.match(renderToStaticMarkup(tree()), /Loading course records/);
      assert.doesNotMatch(renderToStaticMarkup(tree()), /Activity History/);
    }
  } finally {
    delete globalThis.__courseTabTest;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
