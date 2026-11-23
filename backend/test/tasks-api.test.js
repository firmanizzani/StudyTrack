import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { newDb, DataType } from "pg-mem";
import { createApp } from "../app.js";
import { createStore } from "../store.js";

// Run the actual SQL repository and schema without touching a live Neon database.
test("PostgreSQL API: auth, ownership, reminders, persistence, and cascades", async (t) => {
  const memory = newDb();
  memory.public.registerFunction({ name: "trim", args: [DataType.text], returns: DataType.text, implementation: (value) => value.trim() });
  memory.public.registerFunction({ name: "length", args: [DataType.text], returns: DataType.integer, implementation: (value) => value.length });
  memory.public.none(await readFile(new URL("../schema.sql", import.meta.url), "utf8"));
  const { Pool } = memory.adapters.createPg();
  const pool = new Pool();
  const store = createStore(pool);
  const server = createApp(store).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await pool.end(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (url, method = "GET", body, token) => {
    const response = await fetch(base + url, { method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  const a = await request("/auth/register", "POST", { nama: "Student A", email: "a@example.test", password: "test-password" });
  const b = await request("/auth/register", "POST", { nama: "Student B", email: "b@example.test", password: "test-password" });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  const token = a.body.token;
  const otherToken = b.body.token;
  const courses = [];
  for (const name of ["Database Systems", "Data Structures"]) {
    const course = await request("/courses", "POST", { name }, token);
    assert.equal(course.status, 201);
    courses.push(course.body.course);
  }
  const otherCourse = (await request("/courses", "POST", { name: "Other student's course" }, otherToken)).body.course;
  const date = (hours) => new Date(Date.now() + hours * 3600000).toISOString();
  const tasks = [];
  for (const [judul, hours, course] of [["Normal", 48, courses[0]], ["Urgent", 1, courses[1]], ["Overdue", -1, courses[0]], ["Completed", -2, courses[1]]]) {
    const result = await request("/tasks", "POST", { judul, deadline: date(hours), mata_kuliah_id: course.id }, token);
    assert.equal(result.status, 201);
    tasks.push(result.body.task);
  }
  await request(`/tasks/${tasks[3].id}`, "PUT", { status: "selesai" }, token);
  const foreign = (await request("/tasks", "POST", { judul: "Private B", deadline: date(1), mata_kuliah_id: otherCourse.id }, otherToken)).body.task;

  await t.test("auth, duplicate registration, and health", async () => {
    assert.equal((await request("/tasks")).status, 401);
    assert.equal((await request("/auth/login", "POST", { email: "A@EXAMPLE.TEST", password: "test-password" })).status, 200);
    assert.equal((await request("/auth/login", "POST", { email: "a@example.test", password: "wrong" })).status, 401);
    assert.equal((await request("/auth/register", "POST", { nama: "Duplicate", email: "A@EXAMPLE.TEST", password: "test-password" })).status, 409);
    assert.equal((await request("/auth/register", "POST", { nama: {}, email: "bad", password: [] })).status, 400);
    assert.equal((await request("/health")).body.database, "connected");
    assert.equal((await request("/dev/reset", "POST")).status, 404);
    assert.ok(!(await request("/auth/me", "GET", undefined, token)).body.user.password_hash);
  });
  await t.test("return all owned courses' tasks in reminder order with uncached responses", async () => {
    const result = await request("/tasks", "GET", undefined, token);
    assert.deepEqual(result.body.tasks.map((task) => task.judul), ["Urgent", "Overdue", "Normal", "Completed"]);
    assert.deepEqual(result.body.tasks.map((task) => task.deadline_category), ["urgent", "overdue", "normal", "completed"]);
    assert.equal(result.body.tasks[0].mata_kuliah, "Data Structures");
    assert.ok(Number.isFinite(Date.parse(result.body.evaluated_at)));
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.equal((await pool.query("SELECT * FROM tasks WHERE id = $1", [tasks[1].id])).rows[0].deadline_category, undefined);
  });
  await t.test("enforce ownership for task and course reads and mutations", async () => {
    for (const [method, body] of [["GET", undefined], ["PUT", { status: "selesai" }], ["DELETE", undefined]]) {
      assert.equal((await request(`/tasks/${foreign.id}`, method, body, token)).status, 404);
    }
    assert.equal((await request(`/courses/${otherCourse.id}`, "PUT", { name: "Forbidden" }, token)).status, 404);
    assert.equal((await request(`/courses/${otherCourse.id}`, "DELETE", undefined, token)).status, 404);
    assert.equal((await request("/tasks", "POST", { judul: "Forbidden", deadline: date(1), mata_kuliah_id: otherCourse.id }, token)).status, 400);
    assert.equal((await request("/courses", "GET", undefined, token)).body.courses.length, 2);
    assert.equal((await request("/tasks/not-an-id", "GET", undefined, token)).status, 404);
  });
  await t.test("invalid deadlines or status do not partially update rows", async () => {
    for (const deadline of ["bad", "2026-02-30T10:00", {}, null]) {
      assert.equal((await request(`/tasks/${tasks[0].id}`, "PUT", { judul: "Changed", deadline }, token)).status, 400);
      assert.equal((await request("/tasks", "POST", { judul: "Invalid", deadline, mata_kuliah_id: courses[0].id }, token)).status, 400);
    }
    assert.equal((await request(`/tasks/${tasks[0].id}`, "PUT", { judul: "Changed", status: "bad" }, token)).status, 400);
    assert.equal((await store.findTask(tasks[0].id, a.body.user.id)).judul, "Normal");
  });
  await t.test("complete, reopen, and edit deadlines without stale categories", async () => {
    const id = tasks[2].id;
    await request(`/tasks/${id}`, "PUT", { status: "selesai" }, token);
    assert.equal((await request("/tasks", "GET", undefined, token)).body.tasks.find((task) => task.id === id).deadline_category, "completed");
    await request(`/tasks/${id}`, "PUT", { status: "belum", deadline: date(2) }, token);
    assert.equal((await request("/tasks", "GET", undefined, token)).body.tasks.find((task) => task.id === id).deadline_category, "urgent");
    await request(`/tasks/${id}`, "PUT", { deadline: "2026-07-02T10:00" }, token);
    assert.equal((await store.findTask(id, a.body.user.id)).deadline, "2026-07-02T03:00:00.000Z");
  });
  await t.test("parallel inserts retain all rows with unique database-generated IDs", async () => {
    const result = await Promise.all(Array.from({ length: 6 }, (_, i) => request("/tasks", "POST", {
      judul: `Parallel ${i}`, deadline: date(3), mata_kuliah_id: courses[0].id
    }, token)));
    assert.ok(result.every((item) => item.status === 201));
    assert.equal(new Set(result.map((item) => item.body.task.id)).size, 6);
    assert.equal((await store.listTasks(a.body.user.id)).length, 10);
  });
  await t.test("course deletion cascades only to that course's tasks", async () => {
    assert.equal((await request(`/courses/${courses[0].id}`, "DELETE", undefined, token)).status, 200);
    assert.ok((await store.listTasks(a.body.user.id)).every((task) => task.mata_kuliah_id === courses[1].id));
    assert.ok(await store.findTask(foreign.id, b.body.user.id));
    assert.equal((await request(`/tasks/${tasks[1].id}`, "DELETE", undefined, token)).status, 200);
    assert.equal(await store.findTask(tasks[1].id, a.body.user.id), null);
  });
});
