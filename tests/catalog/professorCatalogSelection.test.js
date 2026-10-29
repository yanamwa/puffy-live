import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

test("failed generation allows catalog selection and explains how to continue", async () => {
  const course = {
    catalog_id: 4,
    code: "CS 1",
    title: "Programming",
    versions: [
      {
        version_id: 7,
        generation_status: "failed",
        coverage_modules: [{ title: "Variables" }],
      },
    ],
  };
  const harness = { slots: [[course], false, "", "", true, 0, 0], cursor: 0 };
  globalThis.__catalogSelectionTest = harness;
  try {
    const result = await build({
      entryPoints: [
        fileURLToPath(
          new URL(
            "../../src/components/catalog/ProfessorCatalogSelection.jsx",
            import.meta.url,
          ),
        ),
      ],
      bundle: true,
      write: false,
      format: "esm",
      platform: "node",
      jsx: "automatic",
      loader: { ".css": "empty" },
      plugins: [
        {
          name: "controlled-catalog",
          setup(builder) {
            builder.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({
              path: pathToFileURL(require.resolve("react/jsx-runtime")).href,
              external: true,
            }));
            builder.onResolve({ filter: /^react$/ }, () => ({
              path: "hooks",
              namespace: "mock",
            }));
            builder.onResolve({ filter: /catalogApi\.js$/ }, () => ({
              path: "api",
              namespace: "mock",
            }));
            builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({
              contents:
                path === "hooks"
                  ? `export function useState(initial){const h=globalThis.__catalogSelectionTest,i=h.cursor++;if(!(i in h.slots))h.slots[i]=initial;return [h.slots[i],v=>h.slots[i]=typeof v==='function'?v(h.slots[i]):v];}export const useEffect=()=>{};export const useRef=()=>({current:null});`
                  : `export const catalogRequest=()=>{throw new Error('Unexpected request');};`,
            }));
          },
        },
      ],
    });
    const { default: Selection } = await import(
      "data:text/javascript;base64," +
        Buffer.from(result.outputFiles[0].text).toString("base64")
    );
    const find = (node, predicate) => {
      if (Array.isArray(node))
        return node.map((child) => find(child, predicate)).find(Boolean);
      if (!node?.props) return undefined;
      return predicate(node) ? node : find(node.props.children, predicate);
    };
    let form = { contentModules: [] };
    const render = () => {
      harness.cursor = 0;
      return Selection({
        form,
        onChange: (value) => {
          form = value;
        },
        isEditing: false,
      });
    };
    find(render(), (node) => node.props.role === "option").props.onClick();
    assert.equal(form.catalogId, 4);
    assert.equal(form.contentModules[0].title, "Variables");
    assert.deepEqual(form.contentModules[0].lessonPages, []);
    assert.equal(harness.slots[4], false, "selection closes the dropdown");
    const warning = find(render(), (node) => node.props.role === "status");
    assert.match(
      String(warning.props.children),
      /continue.*available syllabus content/s,
    );
    assert.equal(
      find(
        render(),
        (node) =>
          node.type === "button" && node.props.children === "Refresh catalog",
      ),
      undefined,
    );
  } finally {
    delete globalThis.__catalogSelectionTest;
  }
});
