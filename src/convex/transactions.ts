import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    businessId: v.id("businesses"),
    customerId: v.id("customers"),
    productId: v.id("products"),
    quantity: v.number(),
    rate: v.number(), // paise
    notes: v.optional(v.string()),
    date: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const totalAmount = Math.round(args.quantity * args.rate);

    return await ctx.db.insert("transactions", {
      businessId: args.businessId,
      customerId: args.customerId,
      productId: args.productId,
      quantity: args.quantity,
      rate: args.rate,
      totalAmount,
      notes: args.notes,
      date: args.date,
      recordedBy: userId,
    });
  },
});

export const getByBusinessDate = query({
  args: {
    businessId: v.id("businesses"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_business_date", (q) =>
        q.eq("businessId", args.businessId).eq("date", args.date),
      )
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
      .query("transactions")
      .withIndex("by_customer_date", (q) =>
        q.eq("customerId", args.customerId).eq("date", args.date),
      )
      .collect();
  },
});

export const getByCustomer = query({
  args: {
    customerId: v.id("customers"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
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
      .query("transactions")
      .withIndex("by_customer_date", (q) =>
        q
          .eq("customerId", args.customerId)
          .gte("date", args.startDate)
          .lte("date", args.endDate),
      )
      .collect();
  },
});

export const getByBusinessRange = query({
  args: {
    businessId: v.id("businesses"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_business_date", (q) =>
        q
          .eq("businessId", args.businessId)
          .gte("date", args.startDate)
          .lte("date", args.endDate),
      )
      .collect();
  },
});

export const remove = mutation({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.transactionId);
  },
});
