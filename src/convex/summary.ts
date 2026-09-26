import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  getCustomerForUser,
  getBusinessForUser,
  customerTotals,
  statementForCustomer,
  lastDayOfMonth,
} from "./lib/helpers";

/** Monthly product breakdown for a customer (either side, authorized). */
export const customerMonthlySummary = query({
  args: { customerId: v.id("customers"), yearMonth: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const customer = await ctx.db.get(args.customerId);
    if (!customer) return null;
    const business = await ctx.db.get(customer.businessId);
    if (!business) return null;
    if (business.userId !== userId && customer.linkedUserId !== userId) {
      throw new Error("Not authorized");
    }

    const startDate = `${args.yearMonth}-01`;
    const endDate = lastDayOfMonth(args.yearMonth);

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_customer_date", (q) =>
        q.eq("customerId", args.customerId).gte("date", startDate).lte("date", endDate),
      )
      .collect();

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_customer_date", (q) =>
        q.eq("customerId", args.customerId).gte("date", startDate).lte("date", endDate),
      )
      .collect();

    const productMap = new Map<string, { quantity: number; amount: number; unit: string }>();
    for (const t of transactions) {
      if (t.totalAmount <= 0) continue; // skip reversals in breakdown
      const key = t.productName ?? "Unknown";
      const existing = productMap.get(key) ?? { quantity: 0, amount: 0, unit: t.productUnit ?? "" };
      productMap.set(key, {
        quantity: existing.quantity + t.quantity,
        amount: existing.amount + t.totalAmount,
        unit: existing.unit || (t.productUnit ?? ""),
      });
    }

    const productSummary = Array.from(productMap.entries()).map(([name, data]) => ({
      name,
      quantity: data.quantity,
      unit: data.unit,
      amount: data.amount,
    }));

    const confirmedPayments = payments
      .filter((p) => p.status === "confirmed" && !p.reversed)
      .reduce((s, p) => s + p.amount, 0);
    const pendingPayments = payments
      .filter((p) => p.status === "pending" && !p.reversed)
      .reduce((s, p) => s + p.amount, 0);

    return {
      totalBilled: transactions.reduce((s, t) => s + t.totalAmount, 0),
      confirmedPayments,
      pendingPayments,
      due: transactions.reduce((s, t) => s + t.totalAmount, 0) - confirmedPayments,
      products: productSummary,
      transactions,
      payments,
    };
  },
});

/** The business record for a customer of mine (vendor helper kept for compat). */
export const businessForCustomer = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const customer = await ctx.db.get(args.customerId);
    if (!customer) return null;
    const business = await ctx.db.get(customer.businessId);
    if (!business) return null;
    if (business.userId !== userId && customer.linkedUserId !== userId) {
      throw new Error("Not authorized");
    }
    return business;
  },
});
