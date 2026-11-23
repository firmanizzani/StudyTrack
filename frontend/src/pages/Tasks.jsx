import React, { useState } from "react";
import api from "../api.js";
import Navbar from "../components/Navbar.jsx";
import TaskCard from "../components/TaskCard.jsx";
import useTaskData from "../useTaskData.js";

/**
 * Halaman Daftar Tugas: form tambah tugas dan daftar seluruh tugas pengguna
 * lintas mata kuliah, sesuai urutan yang dikirim backend.
 */
export default function Tasks() {
  const { tasks, courses, evaluatedAt, loading, refreshing, loadError, refresh } = useTaskData();
  const [courseId, setCourseId] = useState("");
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const urgentCount = tasks.filter((task) => task.deadline_category === "urgent").length;
  const overdueCount = tasks.filter((task) => task.deadline_category === "overdue").length;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!courseId) {
      setError("Pilih mata kuliah terlebih dahulu.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/tasks", { mata_kuliah_id: courseId, judul, deskripsi, deadline });
      setJudul("");
      setDeskripsi("");
      setDeadline("");
      await refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal menambahkan tugas.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(task) {
    setError("");
    setSaving(true);
    const newStatus = task.status === "selesai" ? "belum" : "selesai";
    try {
      await api.put(`/tasks/${task.id}`, { status: newStatus });
      await refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal mengubah status tugas.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setError("");
    setSaving(true);
    try {
      await api.delete(`/tasks/${id}`);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal menghapus tugas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="container">
        <h1>Daftar Tugas</h1>
        <p className="task-summary">{loading ? "Memuat tugas…" : evaluatedAt
          ? `${urgentCount} tugas mendekati deadline · ${overdueCount} terlambat`
          : "Daftar tugas belum berhasil dimuat."}</p>

        <div className="card">
          <h2>Tambah Tugas</h2>
          <form onSubmit={handleSubmit}>
            <label htmlFor="task-course">Mata kuliah</label>
            <select id="task-course" value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
              <option value="">-- Pilih Mata Kuliah --</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label htmlFor="task-title">Judul tugas</label>
            <input id="task-title"
              type="text"
              placeholder="Judul Tugas"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              required
            />
            <label htmlFor="task-description">Deskripsi (opsional)</label>
            <textarea id="task-description"
              placeholder="Deskripsi (opsional)"
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              rows={2}
            />
            <label htmlFor="task-deadline">Deadline (WIB)</label>
            <input id="task-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
            />
            <button type="submit" disabled={saving || loading}>{saving ? "Menyimpan…" : "Tambah Tugas"}</button>
          </form>
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        <div className="task-list-header">
          <div>
            <h2>Semua Tugas</h2>
            <p className="task-freshness">{evaluatedAt ? `Diperbarui ${new Date(evaluatedAt).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" })} WIB · Otomatis setiap 60 detik saat halaman aktif` : "Memuat data terbaru dari server"}</p>
          </div>
          <button className="btn btn-secondary" onClick={refresh} disabled={refreshing || saving}>
            {refreshing ? "Memperbarui…" : "Perbarui"}
          </button>
        </div>
        {loadError && <p className="error" role="alert">{loadError}</p>}
        {!loading && !loadError && tasks.length === 0 && <p>Belum ada tugas. Tambahkan tugas pertama Anda di atas.</p>}

        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onToggleStatus={handleToggleStatus} onDelete={handleDelete} disabled={saving} />
        ))}
      </div>
    </>
  );
}
