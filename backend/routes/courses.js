import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncRoute, nonEmptyText, validateId } from "./helpers.js";

export function createCourseRoutes(store) {
  const router = Router();
  router.use(requireAuth);
  router.param("id", validateId);
  router.get("/", asyncRoute(async (req, res) => res.json({ courses: await store.listCourses(req.user.id) })));
  const validate = (body, partial = false) => {
    if ((!partial || body.name !== undefined) && !nonEmptyText(body.name)) return false;
    return ["kode", "dosen"].every((key) => body[key] === undefined || typeof body[key] === "string");
  };
  router.post("/", asyncRoute(async (req, res) => {
    if (!validate(req.body)) return res.status(400).json({ error: "Nama mata kuliah wajib diisi dan semua field harus berupa teks." });
    const course = await store.createCourse(req.user.id, req.body);
    res.status(201).json({ course });
  }));
  router.put("/:id", asyncRoute(async (req, res) => {
    if (!validate(req.body, true)) return res.status(400).json({ error: "Data mata kuliah tidak valid." });
    const course = await store.updateCourse(Number(req.params.id), req.user.id, req.body);
    if (!course) return res.status(404).json({ error: "Mata kuliah tidak ditemukan." });
    res.json({ course });
  }));
  router.delete("/:id", asyncRoute(async (req, res) => {
    const course = await store.deleteCourse(Number(req.params.id), req.user.id);
    if (!course) return res.status(404).json({ error: "Mata kuliah tidak ditemukan." });
    res.json({ success: true });
  }));
  return router;
}
