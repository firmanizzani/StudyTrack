import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Resolve the backend env file consistently from root scripts and Vercel Functions.
dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)) });
export const PORT = process.env.PORT || 4000;
export const JWT_SECRET = process.env.JWT_SECRET || "studytrack-secret-key-change-this";
if ((process.env.NODE_ENV === "production" || process.env.VERCEL) &&
    (JWT_SECRET === "studytrack-secret-key-change-this" || JWT_SECRET.startsWith("replace-") || JWT_SECRET.length < 32)) {
  throw new Error("Set JWT_SECRET to a random secret of at least 32 characters before deploying.");
}
