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
  for (const field of ["input-schedule-prep-total-lessons", "select-schedule-prep-requirement", "input-schedule-prep-pdf-url", "textarea-schedule-prep-topics", "totalLessons", "isMandatory", "curriculum"]) {
    assert.ok(block.includes(field), field);
  }
  assert.ok(books.includes("export function CourseBookDraftsFields"));
  assert.ok(books.includes("MAX_BOOKS_PER_LESSON"));
});

test("Qruplar tile opens inline next to Cədvəl hazırlama and the Tədris proqramı tile is gone", () => {
  assert.match(panel, /\['schedule-prep', 'Cədvəl hazırlama', CalendarRange, null\], \['groups', 'Qruplar', Users, 'schedule'\]/);
  assert.ok(panel.includes("t === 'groups' && canEditCourseContent && <GroupManagementSection"));
  assert.ok(!panel.includes("toggleTab('schedule-prep')"), "no separate schedule-prep button outside the tile list");
  assert.ok(panel.includes("view={groupsView}"), "the step indicator opens the matching Qruplar sub-view");
  assert.ok(!panel.includes("'course-content'"));
  assert.ok(!panel.includes("ResourceForm"));
});

test("indicator steps open their own Qruplar sub-views and highlight individually", () => {
  assert.ok(groups.includes("export type GroupsView = 'students' | 'teachers'"));
  assert.ok(groups.includes("onOpenStudents") && groups.includes("onOpenTeachers"));
  assert.ok(groups.includes("function TeacherAssignmentView"));
  assert.ok(groups.includes("NO_TEACHER_LABEL"));
  assert.ok(groups.includes("Linklər"));
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
