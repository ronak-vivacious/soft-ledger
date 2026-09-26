// Shared server utilities: auth context, money/date helpers, notifications.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import {
  users,
  sessions,
  notifications,
  businesses,
  customers,
  transactions,
  payments,
} from "../db/schema";

// --------------------------------------------------------------- auth context

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newId(): string {
  return randomUUID();
}

export function randomCode(alphabet: string, length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export type AuthUser = typeof users.$inferSelect;

/** Resolve the signed-in user from the session cookie. Returns null when absent/expired. */
export async function getSessionUser(ctx: {
  get: (key: "session_token") => string | undefined;
}): Promise<AuthUser | null> {
  const token = ctx.get("session_token");
  if (!token) return null;
  const db = getDb();
  const rows = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);
  if (rows.length === 0) return null;
  const { user, expiresAt } = rows[0];
  if (new Date(expiresAt) < new Date()) return null;
  return user;
}

export class HttpError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function requireUser(ctx: {
  get: (key: "session_token") => string | undefined;
}): Promise<AuthUser> {
  const user = await getSessionUser(ctx);
  if (!user) throw new HttpError("Not authenticated", 401);
  return user;
}

// --------------------------------------------------------------- accessors

export async function getBusinessForUser(userId: string) {
  const db = getDb();
  const rows = await db.select().from(businesses).where(eq(businesses.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function getCustomerForUser(userId: string) {
  const db = getDb();
  const rows = await db.select().from(customers).where(eq(customers.linkedUserId, userId)).limit(1);
  return rows[0] ?? null;
}

// --------------------------------------------------------------- IST dates
// App treats dates in IST (UTC+5:30). Stored as YYYY-MM-DD strings.

export function istTodayString(now = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

export function istCurrentYearMonth(now = new Date()): string {
  return istTodayString(now).slice(0, 7);
}

export function previousYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function previousDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return dt.toISOString().split("T")[0];
}

export function lastDayOfMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().split("T")[0];
}

// --------------------------------------------------------------- money

export function safeMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

/**
 * The single balance calculation used by both sides.
 * due = totalBilled (transactions) - totalConfirmed (confirmed, non-reversed payments)
 */
export async function customerTotals(
  customerId: string,
  opts?: { untilDate?: string },
): Promise<{
  totalBilled: number;
  totalConfirmed: number;
  totalPending: number;
  due: number;
}> {
  const db = getDb();
  const txs = await db.select().from(transactions).where(eq(transactions.customerId, customerId));
  const pays = await db.select().from(payments).where(eq(payments.customerId, customerId));

  let totalBilled = 0;
  for (const t of txs) {
    if (opts?.untilDate && t.date > opts.untilDate) continue;
    totalBilled += safeMoney(t.totalAmount);
  }

  let totalConfirmed = 0;
  let totalPending = 0;
  for (const p of pays) {
    if (opts?.untilDate && p.date > opts.untilDate) continue;
    if (p.status === "confirmed" && !p.reversed) totalConfirmed += safeMoney(p.amount);
    else if (p.status === "pending" && !p.reversed) totalPending += safeMoney(p.amount);
  }

  return { totalBilled, totalConfirmed, totalPending, due: totalBilled - totalConfirmed };
}

/** Statement between two dates (inclusive), with opening balance from before start. */
export async function statementForCustomer(
  customerId: string,
  startDate: string,
  endDate: string,
): Promise<{
  openingBalance: number;
  totalBilled: number;
  confirmedPayments: number;
  closingBalance: number;
}> {
  const db = getDb();
  const openingBalance = (await customerTotals(customerId, { untilDate: previousDay(startDate) })).due;

  const txs = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.customerId, customerId)));
  const pays = await db.select().from(payments).where(eq(payments.customerId, customerId));

  const totalBilled = txs
    .filter((t) => t.date >= startDate && t.date <= endDate)
    .reduce((s, t) => s + safeMoney(t.totalAmount), 0);
  const confirmedPayments = pays
    .filter((p) => p.date >= startDate && p.date <= endDate && p.status === "confirmed" && !p.reversed)
    .reduce((s, p) => s + safeMoney(p.amount), 0);

  return {
    openingBalance,
    totalBilled,
    confirmedPayments,
    closingBalance: openingBalance + totalBilled - confirmedPayments,
  };
}

// --------------------------------------------------------------- notifications

export async function notify(args: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  relatedType?: string;
  relatedId?: string;
}) {
  const db = getDb();
  await db.insert(notifications).values({
    id: newId(),
    userId: args.userId,
    type: args.type,
    title: args.title,
    body: args.body,
    read: false,
    relatedType: args.relatedType,
    relatedId: args.relatedId,
  });
}
