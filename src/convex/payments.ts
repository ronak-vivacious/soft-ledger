import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    businessId: v.id("businesses"),
    customerId: v.id("customers"),
    amount: v.number(), // paise
    method: v.string(),
    notes: v.optional(v.string()),
    date: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("payments", {
      businessId: args.businessId,
      customerId: args.customerId,
      amount: args.amount,
      method: args.method,
      notes: args.notes,
      date: args.date,
      recordedBy: userId,
    });
  },
});

export const getByCustomer = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();
  },
});

export const getByCustomerDate = query({
  args: {
    customerId: v.id("customers"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_customer_date", (q) =>
        q.eq("customerId", args.customerId).eq("date", args.date),
      )
      .collect();
  },
});

export const getByCustomerRange = query({
  args: {
    customerId: v.id("customers"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_customer_date", (q) =>
        q
          .eq("customerId", args.customerId)
          .gte("date", args.startDate)
          .lte("date", args.endDate),
      )
      .collect();
  },
});

export const remove = mutation({
  args: { paymentId: v.id("payments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.paymentId);
  },
});
