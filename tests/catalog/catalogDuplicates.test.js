import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCatalogCode,
  findCatalogCodeMatches,
} from "../../src/services/catalogDuplicates.js";

test("GNED05 matches spaced, mixed-case and full-width course codes", () => {
  for (const code of [
    "GNED05",
    "GNED 05",
    " gned\t05 ",
    "\uFF27\uFF2E\uFF25\uFF24\uFF10\uFF15",
  ])
    assert.equal(normalizeCatalogCode(code), "GNED05");
  assert.notEqual(normalizeCatalogCode("GNED 50"), "GNED05");
});
test("duplicate lookup excludes archived courses and uses the latest normalized code", async () => {
  const existing = {
    catalog_id: 7,
    code: "GNED 05",
    archived_at: "2026-01-01",
  };
  const matches = await findCatalogCodeMatches(" gned05 ", async (path) => {
    const query = new URLSearchParams(path.slice(1));
    assert.equal(query.get("normalizedCode"), "GNED05");
    assert.equal(query.has("includeArchived"), false);
    return { records: [existing, { catalog_id: 8, code: "GNED 50" }, { catalog_id: 9, code: "gned05", archived_at: null }] };
  });
  assert.deepEqual(matches, [{ catalog_id: 9, code: "gned05", archived_at: null }]);
});
test("editing excludes the current course but still detects another course", async () => {
  const records = [
    { catalog_id: 7, code: "GNED 05" },
    { catalog_id: 8, code: "gned05" },
  ];
  assert.deepEqual(
    await findCatalogCodeMatches("GNED05", async () => ({ records }), "7"),
    [records[1]],
  );
});
test("an unavailable duplicate check rejects instead of allowing a save", async () => {
  await assert.rejects(
    findCatalogCodeMatches("GNED05", async () => {
      throw new Error("Offline");
    }),
    /Offline/,
  );
  assert.deepEqual(
    await findCatalogCodeMatches(" ", () => {
      throw new Error("Should not request");
    }),
    [],
  );
});
import { findArchivedCatalogCodeMatches } from "../../src/services/catalogDuplicates.js";
test("archived restore lookup normalizes codes and picks the most recent match", async () => {
 const rows = [
  {catalog_id:1,code:"GNED 08",archived_at:"2026-01-01"},
  {catalog_id:2,code:"gned08",archived_at:"2026-10-21"},
  {catalog_id:3,code:"GNED08",archived_at:null},
  {catalog_id:4,code:"GNED09",archived_at:"2026-10-21"},
 ];
 const result = await findArchivedCatalogCodeMatches(" gned 08 ", async path => {
  const query = new URLSearchParams(path.slice(1));
  assert.equal(query.get("normalizedCode"),"GNED08");
  assert.equal(query.get("archived"),"1");
  return {records:rows};
 });
 assert.deepEqual(result,[rows[1],rows[0]]);
});
