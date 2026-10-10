import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Static checks for «Qruplar» and the book picker inside «Cədvəl hazırlama».
const here = dirname(fileURLToPath(import.meta.url));
const panel = readFileSync(resolve(here, "../components/admin-panel.tsx"), "utf8");
const groups = readFileSync(resolve(here, "../components/group-management.tsx"), "utf8");
const books = readFileSync(resolve(here, "../components/course-books.tsx"), "utf8");

test("Cədvəl hazırlama lesson form embeds the Kitabxana book picker and sends books with the lesson", () => {
  const start = panel.indexOf("function SchedulePrepSection(");
  const block = panel.slice(start, panel.indexOf("function parseDayTimes(", start));
  assert.ok(block.includes("<CourseBookDraftsFields"));
  assert.ok(block.includes("books: entries"));
  assert.ok(block.includes("/admin/schedule-lessons"));
  assert.ok(block.includes("lessonDayTimes"), "days/times are set in step 1");
  assert.ok(block.includes("<SetupSteps active={1}"));
  assert.ok(books.includes("export function CourseBookDraftsFields"));
  assert.ok(books.includes("MAX_BOOKS_PER_LESSON"));
});

test("Qruplar tile opens inline like the other tiles and Tədris proqramı links to it", () => {
  assert.match(panel, /\['schedule-prep', 'Cədvəl hazırlama', CalendarRange, null\], \['groups', 'Qruplar', Users, 'schedule'\]/);
  assert.ok(panel.includes("t === 'groups' && canEditCourseContent && <GroupManagementSection"));
  assert.ok(!panel.includes("toggleTab('schedule-prep')"), "no separate schedule-prep button outside the tile list");
  assert.ok(panel.includes('data-testid="button-open-groups-from-curriculum"'));
});

test("group management offers remove, add, teacher edit and two-step delete", () => {
  assert.match(groups, /Qrup yoxdur\{canCreate && <> — <button[\s\S]{0,250}>Qrup yarat<\/button>/);
  for (const marker of ["Çıxar", "Tələbə əlavə et", "Müəllim əlavə et / çıxar", "Qrupu sil", "Bəli, sil", "?confirm=1", "/admin/groups/", "unavailableReason", "label: 'Cədvəl'", "label: 'Tələbələr'", "label: 'Müəllim'"]) {
    assert.ok(groups.includes(marker), marker);
  }
});

test("no 'LMS' in visible text of the new UI", () => {
  for (const source of [groups, books]) {
    const visible = source.replace(/\/\/.*$/gm, "").match(/>[^<>{}]*</g) ?? [];
    assert.ok(!visible.some((text) => /\bLMS\b/.test(text)));
  }
});
