import { test } from "node:test";
import assert from "node:assert/strict";
import { lessonScheduleLabel, lessonTimeOn, teacherDisplay } from "./format.js";

test("per-day JSON times are formatted, never shown raw", () => {
  const raw = '{"monday":"22:13","saturday":"21:13"}';
  const label = lessonScheduleLabel(["monday", "saturday"], raw);
  assert.equal(label, "Bazar ertəsi 22:13, Şənbə 21:13");
  assert.doesNotMatch(label, /[{}"]/);
  assert.equal(lessonTimeOn(raw, "saturday"), "21:13");
  assert.equal(lessonTimeOn(raw, "friday"), null);
  assert.equal(lessonTimeOn(raw), null);
});

test("same time on every day collapses; plain HH:MM keeps the old format", () => {
  assert.equal(lessonScheduleLabel(["wednesday", "monday"], '{"monday":"18:00","wednesday":"18:00"}'), "Bazar ertəsi, Çərşənbə 18:00");
  assert.equal(lessonScheduleLabel(["monday"], "19:00"), "Bazar ertəsi 19:00");
  assert.equal(lessonScheduleLabel(["monday"], "19:00", { timeSeparator: ", saat " }), "Bazar ertəsi, saat 19:00");
  assert.equal(lessonScheduleLabel(["monday"], null), "Bazar ertəsi");
  assert.equal(lessonScheduleLabel([], "19:00"), "gün təyin olunmayıb");
  assert.equal(lessonScheduleLabel(["monday"], "{broken"), "Bazar ertəsi");
});

test("empty teacher name never leaves a dangling label", () => {
  assert.equal(teacherDisplay("", "  ", null), "Müəllim təyin olunmayıb");
  assert.equal(teacherDisplay("", "Fərman İsayev, Mahir Aliyev"), "Fərman İsayev, Mahir Aliyev");
});
