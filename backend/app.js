import express from "express";
import { getStore } from "./db.js";
import { createAuthRoutes } from "./routes/auth.js";
import { createCourseRoutes } from "./routes/courses.js";
import { createTaskRoutes } from "./routes/tasks.js";
import { asyncRoute } from "./routes/helpers.js";

export function createApp(store = getStore()) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/health", asyncRoute(async (req, res) => {
    await store.check();
    res.json({ status: "ok", database: "connected" });
  }));
  app.use("/api/auth", createAuthRoutes(store));
  app.use("/api/courses", createCourseRoutes(store));
  app.use("/api/tasks", createTaskRoutes(store));
  app.use((req, res) => res.status(404).json({ error: "Endpoint tidak ditemukan." }));
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Format JSON tidak valid." });
    if (err.type === "entity.too.large") return res.status(413).json({ error: "Data permintaan terlalu besar." });
    if (err.code === "23505") return res.status(409).json({ error: "Email sudah terdaftar." });
    console.error("StudyTrack request failed", { code: err.code || "INTERNAL_ERROR" });
    res.status(503).json({ error: "Layanan sementara tidak tersedia. Silakan coba lagi." });
  });
  return app;
}
