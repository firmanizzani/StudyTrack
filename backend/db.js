import "./config.js";
import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { createStore } from "./store.js";

let pool;
let store;
export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in backend/.env or Vercel Environment Variables.");
    const connection = new URL(process.env.DATABASE_URL);
    // Keep full certificate and hostname verification explicit across pg versions.
    if (connection.searchParams.get("sslmode") === "require") connection.searchParams.set("sslmode", "verify-full");
    pool = new pg.Pool({
      connectionString: connection.toString(),
      max: 5,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000,
      query_timeout: 15000
    });
    pool.on("error", (error) => console.error("PostgreSQL pool error", { code: error.code || "CONNECTION_ERROR" }));
    if (process.env.VERCEL) attachDatabasePool(pool);
  }
  return pool;
}
export function getStore() {
  if (!store) store = createStore(getPool());
  return store;
}
