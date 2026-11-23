import test from "node:test";
import assert from "node:assert/strict";
import { formatDeadline, formatRemaining } from "../src/deadlineDisplay.js";

test("display UTC deadlines in WIB", () => {
  const text = formatDeadline("2026-07-02T03:00:00Z");
  assert.match(text, /10[.:]00/);
  assert.match(text, /WIB$/);
  assert.equal(formatDeadline("bad"), "Tanggal tidak valid");
});
test("show meaningful remaining time at boundaries and for overdue tasks", () => {
  assert.equal(formatRemaining(3600, "urgent"), "Sisa 1 jam");
  assert.equal(formatRemaining(43140, "urgent"), "Sisa 11 jam 59 menit");
  assert.equal(formatRemaining(0, "urgent"), "Deadline sekarang");
  assert.equal(formatRemaining(0.1, "urgent"), "Sisa kurang dari 1 menit");
  assert.equal(formatRemaining(-0.1, "overdue"), "Terlambat kurang dari 1 menit");
  assert.equal(formatRemaining(-60, "overdue"), "Terlambat 1 menit");
  assert.equal(formatRemaining(-90000, "overdue"), "Terlambat 1 hari 1 jam");
  assert.equal(formatRemaining(null, "normal"), "");
});
