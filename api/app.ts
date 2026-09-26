// Shared Hono app used by both the Vercel function and the local dev server.
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { handle } from "hono/vercel";
import { authRoutes } from "../src/server/auth";
import { registry } from "../src/server/functions";
import {
  generateForToday,
  expireSubscriptions,
  generateMonthlyBills,
  sendPaymentReminders,
} from "../src/server/functions";
import { getSessionUser } from "../src/server/util";
import { hasDb } from "../src/server/db";

// Routes below use full /api paths; no basePath to avoid double prefixes.
const app = new Hono<{ Variables: { session_token: string } }>();

// Surface unexpected errors with the message (empty 500s are undebuggable).
app.onError((err, c) => {
  console.error("[api] unhandled error:", err);
  return c.json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
});

// Session middleware: read cookie into context.
app.use("/api/*", async (c, next) => {
  const token = getCookie(c, "session_token");
  c.set("session_token", token ?? "");
  await next();
});

app.route("/api/auth", authRoutes);

// RPC endpoint the frontend shim calls: POST /api/fn { fn: "module.function", args }
app.post("/api/fn", async (c) => {
  if (!hasDb()) {
    return c.json({ error: "Database is not configured — connect Neon and set DATABASE_URL" }, 503);
  }
  const body = await c.req
    .json<{ fn?: string; args?: unknown }>()
    .catch(() => ({}) as { fn?: string; args?: unknown });
  const fnName = body.fn;
  if (!fnName || typeof fnName !== "string") {
    return c.json({ error: "Missing fn" }, 400);
  }
  const handler = registry[fnName];
  if (!handler) return c.json({ error: `Unknown function: ${fnName}` }, 404);

  try {
    const user = await getSessionUser(c);
    const result = await handler({ user }, body.args ?? {});
    return c.json({ result });
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode ?? 400;
    const message = err instanceof Error ? err.message : "Request failed";
    if (status >= 500) console.error("[api]", fnName, err);
    return c.json({ error: message }, status as 400);
  }
});

// Health check.
app.get("/api/health", (c) => c.json({ ok: true, db: hasDb() }));

// Cron endpoints (called by Vercel Cron, protected with CRON_SECRET).
function cronAuth(c: { req: { header: (k: string) => string | undefined } }): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // not configured: allow (dev)
  const auth = c.req.header("authorization");
  return auth === `Bearer ${secret}`;
}

app.get("/api/cron/subscription-purchases", async (c) => {
  if (!cronAuth(c)) return c.json({ error: "Unauthorized" }, 401);
  if (!hasDb()) return c.json({ error: "Database is not configured" }, 503);
  const created = await generateForToday();
  return c.json({ ok: true, created });
});

app.get("/api/cron/expire-subscriptions", async (c) => {
  if (!cronAuth(c)) return c.json({ error: "Unauthorized" }, 401);
  if (!hasDb()) return c.json({ error: "Database is not configured" }, 503);
  const expired = await expireSubscriptions();
  return c.json({ ok: true, expired });
});

app.get("/api/cron/monthly-bills", async (c) => {
  if (!cronAuth(c)) return c.json({ error: "Unauthorized" }, 401);
  if (!hasDb()) return c.json({ error: "Database is not configured" }, 503);
  const generated = await generateMonthlyBills();
  return c.json({ ok: true, generated });
});

app.get("/api/cron/payment-reminders", async (c) => {
  if (!cronAuth(c)) return c.json({ error: "Unauthorized" }, 401);
  if (!hasDb()) return c.json({ error: "Database is not configured" }, 503);
  const sent = await sendPaymentReminders();
  return c.json({ ok: true, sent });
});

// Export for Vercel (serverless handler) and for the local dev server.
const vercelHandler = handle(app);
export { app as honoApp, vercelHandler };
export default vercelHandler;
