import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// «Tədris proqramı» bölməsi ləğv olunub: qrup əməliyyatları «Qruplar» bölməsindədir
// və heç bir qlobal CSS qaydası onları gizlətmir.
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "../index.css"), "utf8");
const panel = readFileSync(resolve(here, "../components/admin-panel.tsx"), "utf8");
const groups = readFileSync(resolve(here, "../components/group-management.tsx"), "utf8");

test("no global CSS rule hides group blocks and the old curriculum rules are gone", () => {
  assert.ok(!css.includes("section-semester-groups"));
  assert.ok(!css.includes("section-semester-management"));
  assert.ok(!css.includes("section-selected-subjects"));
});

test("the Tədris proqramı tile and its legacy forms are removed", () => {
  assert.ok(!panel.includes("'course-content'"));
  assert.ok(!panel.includes("Tədris proqramı"));
  for (const dead of ["function ResourceForm", "function ResourceList", "function CourseForm", "function CourseLessonCountForm", "section-semester-groups"]) {
    assert.ok(!panel.includes(dead), dead);
  }
});

test("group actions live in «Qruplar» cards", () => {
  for (const marker of ["button-group-delete-", "button-group-edit-teachers-", "button-group-links-", "button-group-add-students-", "button-group-remove-"]) {
    assert.ok(groups.includes(marker), marker);
  }
});
