import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  getBusinessForUser,
  customerTotals,
  statementForCustomer,
  lastDayOfMonth,
} from "./lib/helpers";
import { Doc, Id } from "./_generated/dataModel";

// ------------------------------------------------------------------ queries

/** Customer: my own account (with unified totals). */
export const getByLinkedUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const customer = await ctx.db
      .query("customers")
      .withIndex("by_linked_user", (q) => q.eq("linkedUserId", userId))
      .first();
    if (!customer) return null;

    const totals = await customerTotals(ctx, customer._id);
    return { ...customer, ...totals };
  },
});

/** Vendor: my customers with unified balances. */
export const getByBusiness = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const business = await getBusinessForUser(ctx, userId);
    if (!business) return [];

    const customers = await ctx.db
      .query("customers")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();

    return await Promise.all(
      customers.map(async (c) => {
        const totals = await customerTotals(ctx, c._id);
        return { ...c, ...totals };
      }),
    );
  },
});

/** Either side: one customer with unified balance + recent statements. */
export const getOne = query({
  args: { customerId: v.id("customers") },
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

    const totals = await customerTotals(ctx, customer._id);

    const bills = await ctx.db
      .query("monthlyBills")
      .withIndex("by_customer_month", (q) => q.eq("customerId", customer._id))
      .collect();
    const recentBills = bills.sort((a, b) => (a.yearMonth < b.yearMonth ? 1 : -1)).slice(0, 6);

    return { ...customer, ...totals, recentBills };
  },
});

/**
 * Unified monthly statement — the SAME calculation for vendor and customer.
 * Includes opening balance, month activity, payments by status, and closing
 * balance. Only participants may read it.
 */
export const getStatement = query({
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
    const statement = await statementForCustomer(ctx, customer._id, startDate, endDate);

    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_customer_date", (q) =>
        q.eq("customerId", customer._id).gte("date", startDate).lte("date", endDate),
      )
      .collect();
    const pays = await ctx.db
      .query("payments")
      .withIndex("by_customer_date", (q) =>
        q.eq("customerId", customer._id).gte("date", startDate).lte("date", endDate),
      )
      .collect();

    const pendingPayments = pays
      .filter((p) => p.status === "pending" && !p.reversed)
      .reduce((s, p) => s + p.amount, 0);
    const rejectedPayments = pays
      .filter((p) => p.status === "rejected" && !p.reversed)
      .reduce((s, p) => s + p.amount, 0);

    return {
      customer,
      business: { _id: business._id, name: business.name },
      yearMonth: args.yearMonth,
      ...statement,
      pendingPayments,
      rejectedPayments,
      transactionCount: txs.length,
    };
  },
});

/** Customer: basic info about my connected vendor. */
export const getMyVendor = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const customer = await ctx.db
      .query("customers")
      .withIndex("by_linked_user", (q) => q.eq("linkedUserId", userId))
      .first();
    if (!customer) return null;
    const business = await ctx.db.get(customer.businessId);
    if (!business) return null;
    return {
      businessId: business._id,
      name: business.name,
      phone: business.phone ?? null,
      active: customer.active !== false,
    };
  },
});

// ---------------------------------------------------------------- mutations

export const create = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const business = await getBusinessForUser(ctx, userId);
    if (!business) throw new Error("Set up your business first");

    const name = args.name.trim();
    if (!name) throw new Error("Customer name is required");

    return await ctx.db.insert("customers", {
      businessId: business._id,
      name,
      phone: args.phone?.trim() || undefined,
      active: true,
    });
  },
});

export const update = mutation({
  args: {
    customerId: v.id("customers"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("Customer not found");
    const business = await ctx.db.get(customer.businessId);
    if (!business || business.userId !== userId) throw new Error("Not authorized");

    const patch: { name?: string; phone?: string; active?: boolean } = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Name cannot be empty");
      patch.name = name;
    }
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (args.active !== undefined) patch.active = args.active;
    if (Object.keys(patch).length > 0) await ctx.db.patch(args.customerId, patch);
    return await ctx.db.get(args.customerId);
  },
});

/** Vendor marks the relationship inactive (customer loses payment recording). */
export const setActive = mutation({
  args: { customerId: v.id("customers"), active: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("Customer not found");
    const business = await ctx.db.get(customer.businessId);
    if (!business || business.userId !== userId) throw new Error("Not authorized");
    await ctx.db.patch(args.customerId, { active: args.active });
  },
});
