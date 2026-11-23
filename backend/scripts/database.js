import { readFile } from "node:fs/promises";
import { getPool } from "../db.js";
import { parseTaskDate } from "../deadlines.js";

const action = process.argv[2];
const pool = getPool();
let client;
try {
  client = await pool.connect();
  if (action === "check") {
    await client.query("SELECT 1 FROM tasks LIMIT 1");
    console.log("Neon/PostgreSQL connection and schema are ready.");
  } else if (action === "migrate") {
    const schema = await readFile(new URL("../schema.sql", import.meta.url), "utf8");
    await client.query("BEGIN");
    await client.query(schema);
    await client.query("COMMIT");
    console.log("Database schema is ready: users, courses, tasks.");
  } else if (action === "import") {
    // Preserve the source file; import only into empty tables, in a single transaction.
    const source = JSON.parse(await readFile(new URL("../db.json", import.meta.url), "utf8"));
    await client.query("BEGIN");
    await client.query("LOCK TABLE users, courses, tasks IN SHARE ROW EXCLUSIVE MODE");
    const { rows: [counts] } = await client.query(`SELECT
      (SELECT count(*) FROM users) + (SELECT count(*) FROM courses) + (SELECT count(*) FROM tasks) AS total`);
    if (Number(counts.total) !== 0) throw new Error("IMPORT_TARGET_NOT_EMPTY");
    for (const user of source.users) {
      await client.query("INSERT INTO users (id, nama, email, password_hash) VALUES ($1,$2,$3,$4)",
        [user.id, user.nama, user.email.trim().toLowerCase(), user.password_hash]);
    }
    for (const course of source.courses) {
      await client.query("INSERT INTO courses (id, user_id, name, kode, dosen) VALUES ($1,$2,$3,$4,$5)",
        [course.id, course.user_id, course.name, course.kode || "", course.dosen || ""]);
    }
    for (const task of source.tasks) {
      const deadline = parseTaskDate(task.deadline);
      const createdAt = parseTaskDate(task.created_at);
      if (deadline === null || createdAt === null) throw new Error("IMPORT_INVALID_DATE");
      await client.query(`INSERT INTO tasks (id,user_id,mata_kuliah_id,judul,deskripsi,deadline,status,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [task.id,task.user_id,task.mata_kuliah_id,task.judul,
        task.deskripsi || "", new Date(deadline).toISOString(),task.status,new Date(createdAt).toISOString()]);
    }
    for (const table of ["users", "courses", "tasks"]) {
      await client.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'),
        COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`);
    }
    await client.query("COMMIT");
    console.log(`Imported ${source.users.length} users, ${source.courses.length} courses, ${source.tasks.length} tasks. Original db.json was preserved.`);
  } else {
    throw new Error("UNKNOWN_DATABASE_COMMAND");
  }
} catch (error) {
  if (client) await client.query("ROLLBACK").catch(() => {});
  // Driver errors can contain connection details. Print only a code, never the URL.
  console.error("Database command failed:", error.code || ({
    IMPORT_TARGET_NOT_EMPTY: "Target database is not empty; no data was imported.",
    IMPORT_INVALID_DATE: "Source data contains an invalid date; no data was imported."
  }[error.message] || "Check database configuration and connectivity."));
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
