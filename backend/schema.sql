CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nama TEXT NOT NULL CHECK (length(trim(nama)) > 0),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email));

CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  kode TEXT NOT NULL DEFAULT '',
  dosen TEXT NOT NULL DEFAULT '',
  UNIQUE (id, user_id)
);
CREATE INDEX IF NOT EXISTS courses_user_id_idx ON courses (user_id);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mata_kuliah_id INTEGER NOT NULL,
  judul TEXT NOT NULL CHECK (length(trim(judul)) > 0),
  deskripsi TEXT NOT NULL DEFAULT '',
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'belum' CHECK (status IN ('belum', 'selesai')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mata_kuliah_id, user_id) REFERENCES courses(id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks (user_id);
CREATE INDEX IF NOT EXISTS tasks_course_owner_idx ON tasks (mata_kuliah_id, user_id);
