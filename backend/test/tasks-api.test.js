import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import jwt from "jsonwebtoken";

test("task API: authenticated cross-course reminders, ownership, writes, and validation", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "studytrack-test-"));
  const dbPath = path.join(directory, "db.json");
  process.env.STUDYTRACK_DB_PATH = dbPath;
  const { default: taskRoutes } = await import("../routes/tasks.js");
  const { JWT_SECRET } = await import("../config.js");
  const now = Date.now();
  const date = (offset) => new Date(now + offset * 3600000).toISOString();
  const makeTask = (id, user_id, mata_kuliah_id, offset, status = "belum") => ({
    id, user_id, mata_kuliah_id, judul: `Task ${id}`, deadline: date(offset), status, created_at: date(-48)
  });
  const initial = {
    nextIds: { task: 6 }, users: [],
    courses: [{ id: 1, user_id: 1, name: "Database Systems" }, { id: 2, user_id: 1, name: "Data Structures" }, { id: 3, user_id: 2, name: "Other student's course" }],
    tasks: [makeTask(1, 1, 1, 48), makeTask(2, 1, 2, 1), makeTask(3, 1, 1, -1),
      makeTask(4, 1, 2, -2, "selesai"), makeTask(5, 2, 3, 0.5)]
  };
  await writeFile(dbPath, JSON.stringify(initial));
  const app = express();
  app.use(express.json());
  app.use("/api/tasks", taskRoutes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    delete process.env.STUDYTRACK_DB_PATH;
    await rm(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}/api/tasks`;
  const token = jwt.sign({ sub: 1, nama: "Test Student", email: "student@example.test" }, JWT_SECRET);
  const request = (url = "", method = "GET", body) => fetch(base + url, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });

  await t.test("reject unauthenticated requests", async () => {
    assert.equal((await fetch(base)).status, 401);
  });
  await t.test("return only this user's tasks across courses in priority order", async () => {
    const res = await request();
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.tasks.map((task) => task.id), [2, 3, 1, 4]);
    assert.deepEqual(body.tasks.map((task) => task.deadline_category), ["urgent", "overdue", "normal", "completed"]);
    assert.equal(body.tasks[0].mata_kuliah, "Data Structures");
    assert.ok(Number.isFinite(Date.parse(body.evaluated_at)));
    assert.deepEqual(JSON.parse(await readFile(dbPath, "utf8")), initial);
  });
  await t.test("prevent another user's task access and changes", async () => {
    assert.equal((await request("/5")).status, 404);
    assert.equal((await request("/5", "PUT", { status: "selesai" })).status, 404);
    assert.equal((await request("/5", "DELETE")).status, 404);
    assert.equal((await request("", "POST", { mata_kuliah_id: 3, judul: "Forbidden", deadline: date(1) })).status, 400);
  });
  await t.test("completion suppresses overdue and reopening restores it", async () => {
    assert.equal((await request("/3", "PUT", { status: "selesai" })).status, 200);
    let list = await (await request()).json();
    assert.equal(list.tasks.find((task) => task.id === 3).deadline_category, "completed");
    await request("/3", "PUT", { status: "belum" });
    list = await (await request()).json();
    assert.equal(list.tasks.find((task) => task.id === 3).deadline_category, "overdue");
  });
  await t.test("invalid dates and status never persist partial updates", async () => {
    const before = await readFile(dbPath, "utf8");
    for (const deadline of ["bad", "2026-02-30T10:00", {}, null]) {
      assert.equal((await request("", "POST", { mata_kuliah_id: 1, judul: "Invalid", deadline })).status, 400);
      assert.equal((await request("/1", "PUT", { judul: "Changed", deadline })).status, 400);
    }
    assert.equal((await request("/1", "PUT", { judul: "Changed", status: "bad" })).status, 400);
    assert.equal(await readFile(dbPath, "utf8"), before);
  });
  await t.test("new and edited deadlines are reflected on the next list request", async () => {
    const res = await request("", "POST", { mata_kuliah_id: 1, judul: "New task", deadline: date(2) });
    assert.equal(res.status, 201);
    const { task } = await res.json();
    let list = await (await request()).json();
    assert.equal(list.tasks.find((item) => item.id === task.id).deadline_category, "urgent");
    await request(`/${task.id}`, "PUT", { deadline: date(48) });
    list = await (await request()).json();
    assert.equal(list.tasks.find((item) => item.id === task.id).deadline_category, "normal");
    assert.equal((await request(`/${task.id}`, "DELETE")).status, 200);
    list = await (await request()).json();
    assert.ok(!list.tasks.some((item) => item.id === task.id));
  });
});
