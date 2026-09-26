import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  getBusinessForUser,
  getCustomerForUser,
  customerTotals,
  istCurrentYearMonth,
} from "./lib/helpers";

/** Vendor overview: everything the home screen needs, in one query. */
export const vendorOverview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const business = await getBusinessForUser(ctx, userId);
    if (!business) return null;

    const today = istCurrentYearMonth() + "-01"; // not used directly; kept simple
    const todayStr = istToday();
    const monthStart = istCurrentYearMonth() + "-01";

    const customers = await ctx.db
      .query("customers")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();

    const activeCustomers = customers.filter((c) => c.active !== false);

    // Aggregate balance + today/month activity per customer.
    let totalOutstanding = 0;
    let totalBilledMonth = 0;
    let monthTxCount = 0;
    const overdueCustomers: Array<{ name: string; due: number }> = [];

    const monthTransactions = await ctx.db
      .query("transactions")
      .withIndex("by_business_date", (q) => q.eq("businessId", business._id).gte("date", monthStart))
      .collect();

    for (const c of activeCustomers) {
      const totals = await customerTotals(ctx, c._id);
      if (totals.due > 0) {
        totalOutstanding += totals.due;
        overdueCustomers.push({ name: c.name, due: totals.due });
      }
    }

    for (const t of monthTransactions) {
      if (t.date >= monthStart && t.totalAmount > 0) totalBilledMonth += t.totalAmount;
      monthTxCount++;
    }

    const todayTx = monthTransactions.filter((t) => t.date === todayStr && t.totalAmount > 0);
    const todayAmount = todayTx.reduce((s, t) => s + t.totalAmount, 0);

    const monthPayments = await ctx.db
      .query("payments")
      .withIndex("by_business_date", (q) => q.eq("businessId", business._id).gte("date", monthStart))
      .collect();
    const confirmedMonth = monthPayments
      .filter((p) => p.status === "confirmed" && !p.reversed && p.date >= monthStart)
      .reduce((s, p) => s + p.amount, 0);
    const pendingVerify = monthPayments.filter(
      (p) => p.status === "pending" && !p.reversed && p.recordedBy !== userId,
    ).length;

    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    const activeSubs = subs.filter((s) => s.status === "active").length;

    // Recent activity: latest 5 transactions (any date).
    const recentTx = monthTransactions
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b._creationTime - a._creationTime))
      .slice(0, 5);
    const recent = await Promise.all(
      recentTx.map(async (t) => {
        const customer = await ctx.db.get(t.customerId);
        return {
          _id: t._id,
          date: t.date,
          productName: t.productName ?? "",
          productUnit: t.productUnit ?? "",
          quantity: t.quantity,
          totalAmount: t.totalAmount,
          customerName: customer?.name ?? "",
        };
      }),
    );

    return {
      businessName: business.name,
      totalCustomers: activeCustomers.length,
      activeSubscriptions: activeSubs,
      todayPurchases: todayAmount,
      todayCount: todayTx.length,
      monthBilled: totalBilledMonth,
      paymentsReceivedMonth: confirmedMonth,
      totalOutstanding,
      pendingVerifications: pendingVerify,
      overdueCustomers: overdueCustomers.sort((a, b) => b.due - a.due).slice(0, 5),
      recentActivity: recent,
    };
  },
});

function istToday(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

/** Customer overview: balance, month totals, subscriptions, pending verifications. */
export const customerOverview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const customer = await getCustomerForUser(ctx, userId);
    if (!customer) return null;

    const business = await ctx.db.get(customer.businessId);
    const totals = await customerTotals(ctx, customer._id);
    const monthStart = istCurrentYearMonth() + "-01";

    const monthTx = await ctx.db
      .query("transactions")
      .withIndex("by_customer_date", (q) =>
        q.eq("customerId", customer._id).gte("date", monthStart),
      )
      .collect();
    const monthBilled = monthTx.filter((t) => t.totalAmount > 0).reduce((s, t) => s + t.totalAmount, 0);

    const monthPay = await ctx.db
      .query("payments")
      .withIndex("by_customer_date", (q) =>
        q.eq("customerId", customer._id).gte("date", monthStart),
      )
      .collect();
    const monthPaid = monthPay
      .filter((p) => p.status === "confirmed" && !p.reversed)
      .reduce((s, p) => s + p.amount, 0);
    const pendingVerify = monthPay.filter(
      (p) => p.status === "pending" && p.recordedBy !== userId,
    ).length;

    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_customer", (q) => q.eq("customerId", customer._id))
      .collect();
    const activeSubs = subs.filter((s) => s.status === "active");

    const recentTx = monthTx
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b._creationTime - a._creationTime))
      .slice(0, 5);

    return {
      customerName: customer.name,
      businessName: business?.name ?? "",
      outstanding: totals.due,
      credit: Math.max(0, -totals.due),
      monthBilled,
      monthPaid,
      pendingVerifications: pendingVerify,
      activeSubscriptions: activeSubs.length,
      recentActivity: recentTx.map((t) => ({
        _id: t._id,
        date: t.date,
        productName: t.productName ?? "",
        productUnit: t.productUnit ?? "",
        quantity: t.quantity,
        totalAmount: t.totalAmount,
      })),
    };
  },
});

/** Unread notification count for badges. */
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.filter((n) => !n.read).length;
  },
});
