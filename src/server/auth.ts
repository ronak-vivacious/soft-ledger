// Auth routes: email OTP request/verify → session cookie, me, logout.
import { Hono } from "hono";
import { eq, and, gt, desc } from "drizzle-orm";
import axios from "axios";
import { getDb, hasDb } from "./db";
import {
  users,
  otpCodes,
  sessions,
  customers,
  businesses,
} from "../db/schema";
import {
  getSessionUser,
  hashToken,
  newId,
  randomCode,
  HttpError,
} from "./util";

const OTP_TTL_MS = 15 * 60 * 1000;

export const authRoutes = new Hono<{ Variables: { session_token: string } }>();

async function sendOtpEmail(email: string, code: string) {
  try {
    await axios.post(
      "https://auth.freebuff.app/send_otp",
      {
        to: email,
        otp: code,
        appName: process.env.VLY_APP_NAME || "Soft Ledger",
      },
      {
        headers: {
          "x-api-key": process.env.OTP_API_KEY || "fb_email_2crN1hqIArZP2bEfvjp5Qik4",
        },
        timeout: 10_000,
      },
    );
  } catch (err) {
    console.error("[auth] OTP email send failed:", err instanceof Error ? err.message : err);
    throw new HttpError("Couldn't send the verification email. Try again shortly.", 502);
  }
}

// POST /api/auth/request-otp  { email }
authRoutes.post("/request-otp", async (c) => {
  if (!hasDb()) throw new HttpError("Database is not configured", 503);
  const db = getDb();
  const body = await c.req.json<{ email?: string }>().catch(() => ({}) as { email?: string });
  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError("Enter a valid email address");
  }

  // Simple rate limit: max 3 codes per email per 10 minutes.
  const recent = await db
    .select()
    .from(otpCodes)
    .where(eq(otpCodes.email, email))
    .orderBy(desc(otpCodes.createdAt))
    .limit(3);
  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  if (recent.length === 3 && recent.every((r) => new Date(r.createdAt).getTime() > tenMinAgo)) {
    throw new HttpError("Too many codes requested. Wait a few minutes.", 429);
  }

  const code = randomCode("0123456789", 6);
  await db.insert(otpCodes).values({
    id: newId(),
    email,
    code,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendOtpEmail(email, code);
  return c.json({ ok: true });
});

// POST /api/auth/verify-otp  { email, code } → sets session cookie
authRoutes.post("/verify-otp", async (c) => {
  if (!hasDb()) throw new HttpError("Database is not configured", 503);
  const db = getDb();
  const body = await c.req
    .json<{ email?: string; code?: string }>()
    .catch(() => ({}) as { email?: string; code?: string });
  const email = (body.email ?? "").trim().toLowerCase();
  const code = (body.code ?? "").trim();
  if (!email || !code) throw new HttpError("Email and code are required");

  const rows = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.email, email), eq(otpCodes.code, code), gt(otpCodes.expiresAt, new Date())))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (rows.length === 0) throw new HttpError("That code didn't work. Check and try again.");

  // Burn the used code.
  await db.delete(otpCodes).where(eq(otpCodes.id, rows[0].id));

  // Find or create the user — new emails become new accounts (sign up = sign in).
  let user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  if (!user) {
    user = (
      await db
        .insert(users)
        .values({ id: newId(), email, emailVerifiedAt: new Date() })
        .returning()
    )[0];
  } else if (!user.emailVerifiedAt) {
    await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
  }

  // Create session.
  const token = randomCode("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 40);
  await db.insert(sessions).values({
    id: newId(),
    tokenHash: hashToken(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });

  c.header(
    "Set-Cookie",
    `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
  );

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      username: user.username,
      role: user.role,
    },
  });
});

// GET /api/auth/me → current user (null if signed out)
authRoutes.get("/me", async (c) => {
  if (!hasDb()) return c.json({ user: null });
  const user = await getSessionUser(c);
  if (!user) return c.json({ user: null });
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      username: user.username,
      role: user.role,
    },
  });
});

// POST /api/auth/logout
authRoutes.post("/logout", async (c) => {
  if (hasDb()) {
    const token = c.get("session_token");
    if (token) {
      const db = getDb();
      await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
    }
  }
  c.header("Set-Cookie", "session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return c.json({ ok: true });
});

// PATCH /api/auth/profile  { name?, phone? }
authRoutes.patch("/profile", async (c) => {
  const user = await getSessionUser(c);
  if (!user) throw new HttpError("Not authenticated", 401);
  const db = getDb();
  const body = await c.req.json<{ name?: string; phone?: string }>().catch(
    () => ({}) as { name?: string; phone?: string },
  );

  const patch: { name?: string; phone?: string } = {};
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) throw new HttpError("Name cannot be empty");
    patch.name = name;
  }
  if (body.phone !== undefined) patch.phone = body.phone.trim() || undefined;
  if (Object.keys(patch).length > 0) {
    await db.update(users).set(patch).where(eq(users.id, user.id));
  }
  const updated = (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0];
  return c.json({ user: updated });
});

// POST /api/auth/claim-username  { username }
const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
authRoutes.post("/claim-username", async (c) => {
  const user = await getSessionUser(c);
  if (!user) throw new HttpError("Not authenticated", 401);
  const db = getDb();
  const body = await c.req.json<{ username?: string }>().catch(() => ({}) as { username?: string });
  const username = (body.username ?? "").trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    throw new HttpError("Use 3-24 lowercase letters, numbers, or underscores");
  }
  if (user.username) throw new HttpError("You already have a username");

  const takenByUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const takenByBiz = await db
    .select()
    .from(businesses)
    .where(eq(businesses.username, username))
    .limit(1);
  if (takenByUser.length > 0 || takenByBiz.length > 0) {
    throw new HttpError("That username is taken");
  }

  await db.update(users).set({ username }).where(eq(users.id, user.id));
  return c.json({ username });
});

// GET /api/auth/search?q=<username|business name> — safe public search
authRoutes.get("/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return c.json({ users: [], businesses: [] });
  const db = getDb();

  const userRows = await db.select().from(users).where(eq(users.username, q)).limit(5);
  const bizRows = await db.select().from(businesses).where(eq(businesses.username, q)).limit(5);

  return c.json({
    users: userRows.map((u) => ({ userId: u.id, name: u.name ?? "Unnamed", username: u.username ?? "" })),
    businesses: bizRows.map((b) => ({ businessId: b.id, name: b.name, username: b.username ?? "" })),
  });
});

// GET /api/auth/customers-of-me — helper for onboarding checks (linked customer row)
authRoutes.get("/linked-customer", async (c) => {
  const user = await getSessionUser(c);
  if (!user) throw new HttpError("Not authenticated", 401);
  const db = getDb();
  const rows = await db.select().from(customers).where(eq(customers.linkedUserId, user.id)).limit(1);
  return c.json({ customer: rows[0] ?? null });
});
