import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);

test("syllabus tabs keep approval controls with super admins and show upload history", async () => {
  const harness = {
    slots: [],
    cursor: 0,
    effects: [],
    role: "professor",
    paths: [],
  };
  const previousWindow = globalThis.window;
  globalThis.__syllabusPageTest = harness;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  const records = [
    {
      version_id: 3,
      catalog_id: 1,
      code: "DCIT 24",
      title: "Information Management",
      filename: "pending.pdf",
      uploader: "Professor",
      status: "draft",
      programs: ["BSIT"],
    },
    {
      version_id: 2,
      catalog_id: 2,
      code: "GNED 05",
      title: "Communication",
      filename: "active.pdf",
      uploader: "Admin",
      status: "active",
      programs: [],
    },
    {
      version_id: 4,
      catalog_id: 3,
      code: "DCIT 25",
      title: "Databases",
      filename: "inactive.pdf",
      uploader: "Professor",
      status: "inactive",
      programs: [],
    },
    {
      version_id: 5,
      catalog_id: 4,
      code: "DCIT 26",
      title: "Networking",
      filename: "rejected.pdf",
      uploader: "Professor",
      status: "rejected",
      programs: [],
    },
  ];
  harness.request = async (path) => {
    harness.paths.push(path);
    const view = new URL("http://localhost" + path).searchParams.get("view");
    return {
      records: view === "approval" ? records.slice(0, 1) : records,
      total: view === "approval" ? 1 : records.length,
      summary: { total: records.length, active: 1, pending: 1, inactive: 1 },
    };
  };
  const mocks = {
    react: `export function useState(initial) {const h=globalThis.__syllabusPageTest,i=h.cursor++;if(!(i in h.slots))h.slots[i]=initial;return [h.slots[i],v=>h.slots[i]=typeof v==='function'?v(h.slots[i]):v];} export const useEffect=fn=>globalThis.__syllabusPageTest.effects.push(fn);export const useCallback=fn=>fn;`,
    auth: `export const useAuth=()=>({user:{role:globalThis.__syllabusPageTest.role}});`,
    api: `export const catalogRequest=(path)=>globalThis.__syllabusPageTest.request(path);export const notifyCatalogChanged=()=>{};`,
    icons: `export const FiUpload=()=>null;`,
    modal: `export const CatalogModal=()=>null;export const PdfPreview=()=>null;`,
    wizard: `export default ()=>null;`,
    coverage: `export const readCoverage=()=>[];`,
    swal: `export default {fire:()=>{throw new Error('Unexpected status change');}};`,
  };
  const cleanups = [];
  try {
    const built = await build({
      entryPoints: [
        fileURLToPath(
          new URL(
            "../../src/pages/shared/SyllabusManagementPage.jsx",
            import.meta.url,
          ),
        ),
      ],
      bundle: true,
      write: false,
      platform: "node",
      format: "esm",
      jsx: "automatic",
      loader: { ".css": "empty" },
      plugins: [
        {
          name: "syllabus-page-services",
          setup(builder) {
            builder.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({
              path: pathToFileURL(require.resolve("react/jsx-runtime")).href,
              external: true,
            }));
            builder.onResolve({ filter: /.*/ }, ({ path }) => {
              const key =
                path === "react"
                  ? "react"
                  : path === "react-icons/fi"
                    ? "icons"
                    : path === "sweetalert2"
                      ? "swal"
                      : path.endsWith("/AuthContext.jsx")
                        ? "auth"
                        : path.endsWith("/catalogApi.js")
                          ? "api"
                          : path.endsWith("/CatalogModal.jsx")
                            ? "modal"
                            : path.endsWith("/SyllabusWizard.jsx")
                              ? "wizard"
                              : path.endsWith("/CoverageModules.jsx")
                                ? "coverage"
                                : null;
              if (key) return { path: key, namespace: "syllabus-mock" };
            });
            builder.onLoad(
              { filter: /.*/, namespace: "syllabus-mock" },
              ({ path }) => ({ contents: mocks[path], loader: "js" }),
            );
          },
        },
      ],
    });
    const { default: Page } = await import(
      "data:text/javascript;base64," +
        Buffer.from(built.outputFiles[0].text).toString("base64")
    );
    const tree = () => {
      harness.cursor = 0;
      harness.effects = [];
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
    const find = (node, label) => {
      if (Array.isArray(node))
        return node.map((child) => find(child, label)).find(Boolean);
      if (!node?.props) return undefined;
      return node.type === "button" && text(node).trim() === label
        ? node
        : find(node.props.children, label);
    };
    const load = async () => {
      while (cleanups.length) cleanups.pop()?.();
      tree();
      for (const effect of harness.effects) cleanups.push(effect());
      await new Promise((resolve) => setTimeout(resolve, 250));
      return tree();
    };
    const row = (node, filename) => {
      if (Array.isArray(node))
        return node.map((child) => row(child, filename)).find(Boolean);
      if (!node?.props) return undefined;
      return node.type === "tr" && text(node).includes(filename)
        ? node
        : row(node.props.children, filename);
    };
    for (const role of ["professor", "admin", "super_admin"]) {
      harness.slots = [];
      harness.role = role;
      let rendered = await load();
      const markup = renderToStaticMarkup(rendered);
      assert.match(markup, /Syllabus Management/);
      assert.match(markup, /Syllabus Approval/);
      assert.match(markup, /Syllabus History/);
      assert.match(markup, /pending.pdf/);
      assert.equal(
        Boolean(find(rendered, "Upload Syllabus")),
        role !== "super_admin",
      );
      assert.equal(Boolean(find(rendered, "Approve")), role === "super_admin");
      assert.equal(Boolean(find(rendered, "Reject")), role === "super_admin");
      assert.equal(Boolean(find(rendered, "Activate")), role === "super_admin");
      for (const record of records) {
        const recordRow = row(rendered, record.filename);
        const expected =
          role === "super_admin"
            ? {
                draft: ["Approve", "Reject"],
                active: ["Deactivate"],
                inactive: ["Activate"],
                rejected: [],
              }[record.status]
            : [];
        for (const label of ["Approve", "Reject", "Activate", "Deactivate"]) {
          assert.equal(
            Boolean(find(recordRow, label)),
            expected.includes(label),
            `${role}: ${record.status} ${label}`,
          );
        }
      }
      assert.equal(
        Boolean(find(rendered, "Deactivate")),
        role === "super_admin",
      );
      find(rendered, "Syllabus Approval").props.onClick();
      assert.match(renderToStaticMarkup(tree()), /Loading syllabi/);
      rendered = await load();
      assert.match(harness.paths.at(-1), /view=approval/);
      assert.match(renderToStaticMarkup(rendered), /pending.pdf/);
      assert.doesNotMatch(renderToStaticMarkup(rendered), /active.pdf/);
      assert.equal(Boolean(find(rendered, "Approve")), role === "super_admin");
      assert.equal(Boolean(find(rendered, "Reject")), role === "super_admin");
      assert.equal(find(rendered, "Activate"), undefined);
      assert.equal(find(rendered, "Deactivate"), undefined);
      find(rendered, "Syllabus History").props.onClick();
      rendered = await load();
      assert.match(harness.paths.at(-1), /view=history/);
      assert.match(renderToStaticMarkup(rendered), /Version #/);
      assert.equal(find(rendered, "Activate"), undefined);
      assert.equal(find(rendered, "Deactivate"), undefined);
      assert.equal(find(rendered, "Approve"), undefined);
      assert.equal(find(rendered, "Reject"), undefined);
    }
  } finally {
    while (cleanups.length) cleanups.pop()?.();
    delete globalThis.__syllabusPageTest;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
