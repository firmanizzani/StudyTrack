import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncRoute, nonEmptyText } from "./helpers.js";

const publicUser = (user) => ({ id: user.id, nama: user.nama, email: user.email });
const signToken = (user) => jwt.sign({ sub: user.id, nama: user.nama, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

export function createAuthRoutes(store) {
  const router = Router();
  router.post("/register", asyncRoute(async (req, res) => {
    const { nama, email, password } = req.body;
    if (!nonEmptyText(nama) || !nonEmptyText(email) || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Nama dan email wajib diisi. Password minimal 6 karakter." });
    }
    const user = await store.createUser({ nama: nama.trim(), email: email.trim().toLowerCase(),
      password_hash: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  }));
  router.post("/login", asyncRoute(async (req, res) => {
    const { email, password } = req.body;
    if (!nonEmptyText(email) || !nonEmptyText(password)) {
      return res.status(400).json({ error: "Email dan password wajib diisi." });
    }
    const user = await store.findUser(email.trim());
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Email atau password salah." });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  }));
  router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));
  return router;
}
