import React from "react";
import { formatDeadline, formatRemaining } from "../deadlineDisplay.js";

/** Deadline category and ordering are supplied by the backend. */
export default function TaskCard({ task, onToggleStatus, onDelete, disabled = false }) {
  const completed = task.status === "selesai";
  const category = completed ? "completed" : task.deadline_category;
  const warning = category === "urgent" || category === "overdue";

  return (
    <article className={`card task-card task-${category || "normal"}`}>
      <div className="task-details">
        <strong>{completed ? <s>{task.judul}</s> : task.judul}</strong>
        <div className="meta">{task.mata_kuliah}</div>
        <div className="meta">Deadline: {formatDeadline(task.deadline)}</div>
        {warning && <p className={`deadline-message ${category}`}>
          {formatRemaining(task.remaining_seconds, category)}
        </p>}
        {task.deskripsi && <div className="meta task-description">{task.deskripsi}</div>}
      </div>
      <div className="task-controls">
        <div className="task-badges">
          {warning && <span className={`badge deadline-${category}`}>
            {category === "urgent" ? "Mendekati Deadline" : "Terlambat"}
          </span>}
          <span className={`badge ${task.status}`}>{completed ? "Selesai" : "Belum"}</span>
        </div>
        <div className="task-actions">
          <button className="btn" onClick={() => onToggleStatus(task)} disabled={disabled}>
            {completed ? "Tandai Belum" : "Tandai Selesai"}
          </button>
          <button className="btn btn-secondary" onClick={() => onDelete(task.id)} disabled={disabled}>
            Hapus
          </button>
        </div>
      </div>
    </article>
  );
}
