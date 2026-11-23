/** Parameterized, user-scoped SQL. Time-dependent reminder fields remain outside storage. */
export function createStore(pool) {
  const rows = async (sql, values = []) => (await pool.query(sql, values)).rows.map((row) => {
    const normalized = { ...row };
    for (const key of ["deadline", "created_at"]) {
      if (normalized[key] instanceof Date) normalized[key] = normalized[key].toISOString();
    }
    return normalized;
  });
  const one = async (sql, values) => (await rows(sql, values))[0] || null;
  // Table and field names only originate from the fixed allowlists below.
  const update = (table, id, userId, fields, allowed) => {
    const entries = allowed.filter((key) => fields[key] !== undefined).map((key) => [key, fields[key]]);
    if (!entries.length) return one(`SELECT * FROM ${table} WHERE id = $1 AND user_id = $2`, [id, userId]);
    const assignments = entries.map(([key], index) => `${key} = $${index + 3}`).join(", ");
    return one(`UPDATE ${table} SET ${assignments} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId, ...entries.map(([, value]) => value)]);
  };

  return {
    check: () => pool.query("SELECT 1"),
    findUser: (email) => one("SELECT * FROM users WHERE lower(email) = lower($1)", [email]),
    createUser: ({ nama, email, password_hash }) => one(
      "INSERT INTO users (nama, email, password_hash) VALUES ($1, $2, $3) RETURNING *", [nama, email, password_hash]),
    listCourses: (userId) => rows("SELECT * FROM courses WHERE user_id = $1 ORDER BY id", [userId]),
    createCourse: (userId, { name, kode = "", dosen = "" }) => one(
      "INSERT INTO courses (user_id, name, kode, dosen) VALUES ($1, $2, $3, $4) RETURNING *", [userId, name, kode, dosen]),
    updateCourse: (id, userId, fields) => update("courses", id, userId, fields, ["name", "kode", "dosen"]),
    deleteCourse: (id, userId) => one("DELETE FROM courses WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]),
    listTasks: (userId) => rows(`SELECT t.*, c.name AS mata_kuliah FROM tasks t
      JOIN courses c ON c.id = t.mata_kuliah_id AND c.user_id = t.user_id WHERE t.user_id = $1`, [userId]),
    findTask: (id, userId) => one("SELECT * FROM tasks WHERE id = $1 AND user_id = $2", [id, userId]),
    createTask: (userId, { mata_kuliah_id, judul, deskripsi = "", deadline }) => one(
      `INSERT INTO tasks (user_id, mata_kuliah_id, judul, deskripsi, deadline)
       SELECT user_id, id, $3::text, $4::text, $5::timestamptz FROM courses WHERE id = $2 AND user_id = $1 RETURNING *`,
      [userId, mata_kuliah_id, judul, deskripsi, deadline]),
    updateTask: (id, userId, fields) => update("tasks", id, userId, fields, ["judul", "deskripsi", "deadline", "status"]),
    deleteTask: (id, userId) => one("DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId])
  };
}
