// Server-only database client: Neon serverless Postgres via Drizzle.
// Lazy-initialized so importing this module never crashes when DATABASE_URL
// is missing (dev preview before the user connects a database).
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

let _db: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw Object.assign(new Error("DATABASE_URL is not configured"), {
      statusCode: 503,
    });
  }
  const sql = neon(url);
  _db = drizzle(sql, { schema });
  return _db;
}

export function hasDb(): boolean {
  return !!process.env.DATABASE_URL;
}

export { schema };
