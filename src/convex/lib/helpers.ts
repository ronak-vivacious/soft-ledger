import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

// ---------------------------------------------------------------- IST time
// App treats dates in IST. Server runs in UTC, so "today" in IST is UTC+5:30 —
// before 05:30 UTC it's still "yesterday" in IST.

export function istTodayString(now = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

export function istCurrentYearMonth(now = new Date()): string {
  return istTodayString(now).slice(0, 7); // YYYY-MM
}

export function previousYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1)); // m-1 index minus one month
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------- roles

export async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const { getAuthUserId } = await import("@convex-dev/auth/server");
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

export function assertVendor(ctx: QueryCtx | MutationCtx, business: Doc<"businesses">, userId: Id<"users">) {
  if (business.userId !== userId) {
    throw new Error("Only the business owner can do this");
  }
}

/** Ensure the user is linked to this customer row (owner or linked customer). */
export async function assertCustomerAccess(
  ctx: QueryCtx | MutationCtx,
  customer: Doc<"customers">,
  userId: Id<"users">,
  business?: Doc<"businesses">,
) {
  const isOwner = business ? business.userId === userId : false;
  if (isOwner || customer.linkedUserId === userId) return;
  throw new Error("Not authorized for this customer");
}

// ---------------------------------------------------------------- accessors

export async function getBusinessForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"businesses"> | null> {
  return await ctx.db
    .query("businesses")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

export async function getCustomerForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"customers"> | null> {
  return await ctx.db
    .query("customers")
    .withIndex("by_linked_user", (q) => q.eq("linkedUserId", userId))
    .first();
}

// ------------------------------------------------------- finance (source of truth)
// Money is stored as integer paise; signed totals allow reversals/credits.

export function safeMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

/**
 * The single balance calculation used by both sides.
 * outstanding = charges (transactions) - confirmed payments
 * Confirmed-only keeps vendor/customer totals identical, and pending/rejected
 * payments never inflate or shrink either side's balance.
 */
export async function customerTotals(
  ctx: QueryCtx | MutationCtx,
  customerId: Id<"customers">,
  opts?: { untilDate?: string },
): Promise<{
  totalBilled: number;
  totalConfirmed: number;
  totalPending: number;
  due: number;
}> {
  const transactions = await ctx.db
    .query("transactions")
    .withIndex("by_customer", (q) => q.eq("customerId", customerId))
    .collect();

  const payments = await ctx.db
    .query("payments")
    .withIndex("by_customer", (q) => q.eq("customerId", customerId))
    .collect();

  let totalBilled = 0;
  for (const t of transactions) {
    if (opts?.untilDate && t.date > opts.untilDate) continue;
    totalBilled += safeMoney(t.totalAmount);
  }

  let totalConfirmed = 0;
  let totalPending = 0;
  for (const p of payments) {
    if (opts?.untilDate && p.date > opts.untilDate) continue;
    if (p.status === "confirmed" && !p.reversed) {
      totalConfirmed += safeMoney(p.amount);
    } else if (p.status === "pending" && !p.reversed) {
      totalPending += safeMoney(p.amount);
    }
  }

  return {
    totalBilled,
    totalConfirmed,
    totalPending,
    due: totalBilled - totalConfirmed,
  };
}

/** Statement between two dates (inclusive), with opening balance from before start. */
export async function statementForCustomer(
  ctx: QueryCtx | MutationCtx,
  customerId: Id<"customers">,
  startDate: string,
  endDate: string,
): Promise<{
  openingBalance: number;
  totalBilled: number;
  confirmedPayments: number;
  closingBalance: number;
}> {
  const totalsAll = await customerTotals(ctx, customerId, { untilDate: previousDay(startDate) });
  const openingBalance = totalsAll.due;

  const txs = await ctx.db
    .query("transactions")
    .withIndex("by_customer_date", (q) =>
      q.eq("customerId", customerId).gte("date", startDate).lte("date", endDate),
    )
    .collect();
  const pays = await ctx.db
    .query("payments")
    .withIndex("by_customer_date", (q) =>
      q.eq("customerId", customerId).gte("date", startDate).lte("date", endDate),
    )
    .collect();

  const totalBilled = txs.reduce((s, t) => s + safeMoney(t.totalAmount), 0);
  const confirmedPayments = pays
    .filter((p) => p.status === "confirmed" && !p.reversed)
    .reduce((s, p) => s + safeMoney(p.amount), 0);

  return {
    openingBalance,
    totalBilled,
    confirmedPayments,
    closingBalance: openingBalance + totalBilled - confirmedPayments,
  };
}

export function previousDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return dt.toISOString().split("T")[0];
}

/** Last day of a YYYY-MM month, as YYYY-MM-DD. */
export function lastDayOfMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0)); // day 0 of next month = last of this
  return d.toISOString().split("T")[0];
}

// ------------------------------------------------------------- notifications

export async function notify(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    type: string;
    title: string;
    body?: string;
    relatedType?: string;
    relatedId?: string;
  },
) {
  await ctx.db.insert("notifications", {
    userId: args.userId,
    type: args.type,
    title: args.title,
    body: args.body,
    read: false,
    relatedType: args.relatedType,
    relatedId: args.relatedId,
  });
}

/** Fire a notification for a user id string if it maps to a real user. */
export async function notifyId(
  ctx: MutationCtx,
  userId: string,
  args: {
    type: string;
    title: string;
    body?: string;
    relatedType?: string;
    relatedId?: string;
  },
) {
  await notify(ctx, { ...args, userId: userId as Id<"users"> });
}
