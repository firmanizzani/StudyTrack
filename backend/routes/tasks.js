import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { parseTaskDate, prepareTaskList } from "../deadlines.js";
import { asyncRoute, nonEmptyText, validId, validateId } from "./helpers.js";

function validateTask(body, partial = false) {
  if ((!partial || body.judul !== undefined) && !nonEmptyText(body.judul)) return "Judul tugas wajib diisi.";
  if (body.deskripsi !== undefined && typeof body.deskripsi !== "string") return "Deskripsi harus berupa teks.";
  if ((!partial || body.deadline !== undefined) && parseTaskDate(body.deadline) === null) {
    return "Deadline harus berupa tanggal dan waktu yang valid (WIB).";
  }
  if (body.status !== undefined && !["belum", "selesai"].includes(body.status)) return "Status hanya boleh 'belum' atau 'selesai'.";
  return null;
}
function taskFields(body) {
  const result = { ...body };
  if (body.deadline !== undefined) result.deadline = new Date(parseTaskDate(body.deadline)).toISOString();
  return result;
}

export function createTaskRoutes(store) {
  const router = Router();
  router.use(requireAuth);
  router.param("id", validateId);
  router.get("/", asyncRoute(async (req, res) => {
    const now = new Date();
    const tasks = await store.listTasks(req.user.id);
    res.json(prepareTaskList(tasks, now));
  }));
  router.get("/:id", asyncRoute(async (req, res) => {
    const task = await store.findTask(Number(req.params.id), req.user.id);
    if (!task) return res.status(404).json({ error: "Tugas tidak ditemukan." });
    res.json({ task });
  }));
  router.post("/", asyncRoute(async (req, res) => {
    const error = validateTask(req.body);
    if (error) return res.status(400).json({ error });
    if (!validId(req.body.mata_kuliah_id)) return res.status(400).json({ error: "Pilih mata kuliah yang valid." });
    const task = await store.createTask(req.user.id, { ...taskFields(req.body), mata_kuliah_id: Number(req.body.mata_kuliah_id) });
    if (!task) return res.status(400).json({ error: "Mata kuliah tidak ditemukan untuk user ini." });
    res.status(201).json({ task });
  }));
  router.put("/:id", asyncRoute(async (req, res) => {
    const error = validateTask(req.body, true);
    if (error) return res.status(400).json({ error });
    const task = await store.updateTask(Number(req.params.id), req.user.id, taskFields(req.body));
    if (!task) return res.status(404).json({ error: "Tugas tidak ditemukan." });
    res.json({ task });
  }));
  router.delete("/:id", asyncRoute(async (req, res) => {
    const task = await store.deleteTask(Number(req.params.id), req.user.id);
    if (!task) return res.status(404).json({ error: "Tugas tidak ditemukan." });
    res.json({ success: true });
  }));
  return router;
}
