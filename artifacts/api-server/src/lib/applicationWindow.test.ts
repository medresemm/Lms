import assert from "node:assert/strict";
import test from "node:test";
import { getApplicationWindowStatus } from "./applicationWindow.js";

const opening = "2026-08-31T08:00:00.000Z";
const closing = "2026-08-31T10:00:00.000Z";
const openingMs = Date.parse(opening);
const closingMs = Date.parse(closing);

test("reports an unscheduled window as open", () => {
  assert.deepEqual(getApplicationWindowStatus(null, null, openingMs), {
    opensAt: null,
    closesAt: null,
    isOpen: true,
    nextOpenAt: null,
    status: "unscheduled",
  });
});

test("reports a window before its opening instant as not started", () => {
  assert.deepEqual(getApplicationWindowStatus(opening, closing, openingMs - 1), {
    opensAt: opening,
    closesAt: closing,
    isOpen: false,
    nextOpenAt: opening,
    status: "not_started",
  });
});

test("opens at the exact opening instant", () => {
  assert.equal(getApplicationWindowStatus(opening, closing, openingMs).status, "open");
  assert.equal(getApplicationWindowStatus(opening, closing, openingMs).isOpen, true);
});

test("stays open immediately before the closing instant", () => {
  assert.equal(getApplicationWindowStatus(opening, closing, closingMs - 1).status, "open");
  assert.equal(getApplicationWindowStatus(opening, closing, closingMs - 1).isOpen, true);
});

test("ends at the exact closing instant", () => {
  assert.deepEqual(getApplicationWindowStatus(opening, closing, closingMs), {
    opensAt: opening,
    closesAt: closing,
    isOpen: false,
    nextOpenAt: null,
    status: "ended",
  });
});

test("keeps timezone-offset timestamps tied to the same instant", () => {
  const offsetOpening = "2026-08-31T12:00:00.000+04:00";
  const offsetClosing = "2026-08-31T14:00:00.000+04:00";
  const result = getApplicationWindowStatus(offsetOpening, offsetClosing, openingMs);

  assert.equal(result.status, "open");
  assert.equal(result.isOpen, true);
  assert.equal(Date.parse(offsetOpening), openingMs);
  assert.equal(Date.parse(offsetClosing), closingMs);
});

test("treats malformed or reversed schedules as ended", () => {
  assert.equal(getApplicationWindowStatus("not-a-date", closing, openingMs).status, "ended");
  assert.equal(getApplicationWindowStatus(closing, opening, openingMs).status, "ended");
});