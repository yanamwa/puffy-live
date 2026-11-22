import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const bundle = buildSync({
  entryPoints: [
    fileURLToPath(
      new URL(
        "../../src/components/students/PracticeTopicMastery.jsx",
        import.meta.url,
      ),
    ),
  ],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});
const source = Buffer.from(bundle.outputFiles[0].contents).toString("base64");
const { default: Mastery } = await import(
  `data:text/javascript;base64,${source}`
);
const render = (topics) =>
  renderToStaticMarkup(createElement(Mastery, { topics }));

test("least mastered includes exact ties while topic mastery shows every topic and its answer counts", () => {
  const markup = render([
    { topic: "Keys", correct: 1, total: 2 },
    { topic: "Roles", correct: 2, total: 4 },
    { topic: "Indexes", correct: 501, total: 1001 },
    { topic: "Views", correct: 3, total: 4 },
    { topic: "Schemas", correct: 1, total: 1 },
  ]);
  const [least, topics] = markup.split("<h4>Topic mastery</h4>");
  assert.match(least, /Least mastered.*50%.*Keys.*Roles/);
  assert.doesNotMatch(least, /Indexes|Views|Schemas/);
  assert.match(
    topics,
    /Keys.*1 of 2 correct.*Roles.*2 of 4 correct.*Indexes.*50%/,
  );
  assert.match(topics, /<details><summary>1 more topic<\/summary>.*Schemas/);
});

test("perfect results, measured zeroes and missing topic evidence have distinct displays", () => {
  assert.match(
    render([{ topic: "Keys", correct: 1, total: 1 }]),
    /every graded topic question correctly.*100%/,
  );
  assert.match(
    render([{ topic: "Keys", correct: 0, total: 2 }]),
    /Least mastered.*0%.*Keys.*0 of 2 correct/,
  );
  assert.match(render([]), /No topic to rank yet.*No graded answers/);
  assert.doesNotMatch(render(undefined), /0%/);
});
