import test from "node:test";
import assert from "node:assert/strict";
import { classifyDeadline, parseTaskDate, prepareTaskList } from "../deadlines.js";

const task = (id, deadline, extra = {}) => ({ id, deadline, status: "belum",
  created_at: "2026-06-15T09:00:00", ...extra });

const cases = [
  ["ID 2 is urgent one hour before deadline", "2026-07-02T10:00", "2026-07-02T09:00+07:00", "belum", "urgent"],
  ["ID 1 is urgent with 11 hours 59 minutes left", "2026-07-03T23:59", "2026-07-03T12:00+07:00", "belum", "urgent"],
  ["ID 3 remains normal several days ahead", "2026-07-06T23:59", "2026-07-02T09:00+07:00", "belum", "normal"],
  ["exactly 24 hours is normal", "2026-07-03T23:59", "2026-07-02T23:59+07:00", "belum", "normal"],
  ["23 hours 59 minutes is urgent", "2026-07-03T23:59", "2026-07-03T00:00+07:00", "belum", "urgent"],
  ["one minute late is overdue", "2026-07-02T10:00", "2026-07-02T10:01+07:00", "belum", "overdue"],
  ["finished tasks suppress overdue", "2026-07-02T10:00", "2026-07-02T10:01+07:00", "selesai", "completed"],
  ["exact deadline is urgent", "2026-07-02T10:00", "2026-07-02T10:00+07:00", "belum", "urgent"],
  ["one millisecond past deadline is overdue", "2026-07-02T10:00", "2026-07-02T10:00:00.001+07:00", "belum", "overdue"],
  ["one millisecond inside threshold is urgent", "2026-07-03T10:00", "2026-07-02T10:00:00.001+07:00", "belum", "urgent"],
  ["finished future tasks suppress urgent", "2026-07-02T10:00", "2026-07-02T09:00+07:00", "selesai", "completed"]
];
for (const [name, deadline, now, status, expected] of cases) {
  test(name, () => assert.equal(classifyDeadline(task(1, deadline, { status }), Date.parse(now)), expected));
}

test("local WIB and explicit UTC timestamps represent the same instant", () => {
  assert.equal(parseTaskDate("2026-07-02T10:00"), Date.parse("2026-07-02T03:00:00Z"));
  assert.equal(parseTaskDate("2026-07-02T10:00:00+07:00"), parseTaskDate("2026-07-02T03:00Z"));
});

test("reject invalid calendar dates, types, and times", () => {
  for (const value of [null, {}, 1, "", "bad", "2026-02-30T10:00", "2026-13-01T10:00", "2026-07-02T24:00", "2026-07-02T10:60", "2026-07-02"]) {
    assert.equal(parseTaskDate(value), null, String(value));
  }
  assert.notEqual(parseTaskDate("2028-02-29T10:00"), null);
});

test("sort all groups deterministically and leave stored records unchanged", () => {
  const tasks = [
    task(9, "2026-07-06T10:00", { created_at: "2026-06-16T09:00" }),
    task(8, "2026-07-06T10:00"),
    task(7, "2026-07-01T10:00", { status: "selesai", created_at: "2026-06-16T09:00" }),
    task(6, "2026-07-01T10:00", { status: "selesai" }),
    task(5, "2026-07-02T12:00"), task(4, "2026-07-02T10:00"),
    task(3, "2026-07-01T12:00"), task(2, "2026-07-01T10:00"), task(1, "2026-07-02T10:00")
  ];
  const before = structuredClone(tasks);
  const response = prepareTaskList(tasks, "2026-07-02T09:00+07:00");
  assert.deepEqual(response.tasks.map((t) => t.id), [1, 4, 5, 2, 3, 9, 8, 7, 6]);
  assert.equal(response.evaluated_at, "2026-07-02T02:00:00.000Z");
  assert.equal(response.tasks[0].remaining_seconds, 3600);
  assert.equal(response.tasks[0].deadline, "2026-07-02T03:00:00.000Z");
  assert.deepEqual(tasks, before);
});

test("successive refreshes reflect time passing without any database writes", () => {
  const tasks = [task(1, "2026-07-03T10:00")];
  const category = (now) => prepareTaskList(tasks, now).tasks[0].deadline_category;
  assert.equal(category("2026-07-02T10:00+07:00"), "normal");
  assert.equal(category("2026-07-02T10:01+07:00"), "urgent");
  assert.equal(category("2026-07-03T10:01+07:00"), "overdue");
});

test("malformed legacy records remain visible with no fabricated remaining time", () => {
  const result = prepareTaskList([task(1, "bad")]);
  assert.equal(result.tasks[0].deadline_category, "normal");
  assert.equal(result.tasks[0].remaining_seconds, null);
});
