import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import postcss from "postcss";

test("Course Management button colors have one independent owner per action", () => {
  const css = postcss.parse(
    fs.readFileSync(
      new URL("../../src/components/catalog/catalog.css", import.meta.url),
      "utf8",
    ),
  );
  const owners = new Map();
  css.walkRules((rule) => {
    if (
      !rule.selector.includes("button") &&
      !rule.selector.includes("catalog-action-") &&
      !rule.selector.includes("catalog-class-view") &&
      !rule.selector.includes("catalog-class-archive") &&
      !rule.selector.includes("catalog-class-restore")
    )
      return;
    if (rule.selector.includes("catalog-selection") || rule.selector.includes("::file-selector-button")) return;
    rule.walkDecls((decl) => {
      if (
        ![
          "background",
          "background-color",
          "border-color",
          "color",
          "border",
        ].includes(decl.prop)
      )
        return;
      assert.match(
        rule.selector,
        /^\.catalog-button\.catalog-[\w-]+(?::hover|\[aria-selected="true"\])?$/,
      );
      assert.equal(Boolean(decl.important), false, rule.selector);
      const key = `${rule.selector}:${decl.prop}`;
      assert.equal(owners.has(key), false, `Duplicate color owner: ${key}`);
      owners.set(key, decl.value);
    });
  });
  for (const action of [
    "action-view",
    "action-edit",
    "action-upload-version",
    "upload-syllabus",
    "upload-version",
    "view-pdf",
    "save-details",
    "save-draft",
    "save-activate",
    "cancel",
    "extract",
    "coverage-add",
    "coverage-remove",
    "refresh",
    "retry",
    "page-previous",
    "page-next",
    "action-archive",
    "action-restore",
    "action-activate",
    "class-view",
    "class-archive",
    "class-restore",
    "close",
  ]) {
    for (const prop of ["background", "border-color", "color"])
      assert.ok(
        owners.has(`.catalog-button.catalog-${action}:${prop}`),
        `Missing independent ${prop} for ${action}`,
      );
  }
  const page = fs.readFileSync(
    new URL(
      "../../src/pages/admin/modules/CourseManagementPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(
    !page.includes("admin-module-actions"),
    "Legacy important button rules must not apply",
  );
  assert.ok(
    !page.includes("catalog-primary"),
    "Primary button colors must not override action colors",
  );
});
