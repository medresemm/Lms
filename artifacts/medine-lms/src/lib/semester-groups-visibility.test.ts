import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Regression: global CSS used to hide the whole «Semestr fənləri» block with
// display:none, which made «Müəllim əlavə et / çıxar» and «Qrupu sil»
// invisible and unclickable in Tədris proqramı.
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "../index.css"), "utf8");
const panel = readFileSync(resolve(here, "../components/admin-panel.tsx"), "utf8");

test("no global CSS rule hides the semester groups block", () => {
  assert.doesNotMatch(css, /section-semester-management"\]\s*>\s*div\.mt-8/);
  assert.ok(!css.includes("section-semester-groups"));
});

test("group actions are rendered inside the semester groups block", () => {
  const start = panel.indexOf('data-testid="section-semester-groups"');
  assert.ok(start > -1);
  const block = panel.slice(start, start + 12_000);
  assert.ok(block.includes("button-delete-resource-group-"));
  assert.ok(block.includes("button-edit-group-teachers-"));
});
