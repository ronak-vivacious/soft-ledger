import { defineConfig } from "drizzle-kit";
import { readFileSync } from "node:fs";

// Minimal .env.local reader so drizzle-kit works without dotenv.
function readEnv(key: string): string | undefined {
  try {
    const content = readFileSync(".env.local", "utf-8");
    const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
    return match?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || readEnv("DATABASE_URL") || "",
  },
});
