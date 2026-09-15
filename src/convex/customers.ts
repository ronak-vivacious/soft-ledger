import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    businessId: v.id("businesses"),
    name: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("customers", {
      businessId: args.businessId,
      name: args.name,
      phone: args.phone,
    });
  },
});

export const getByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const customers = await ctx.db
      .query("customers")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    // Calculate balances for each customer
    const result = await Promise.all(
      customers.map(async (customer) => {
        // Get total transactions
        const transactions = await ctx.db
          .query("transactions")
          .withIndex("by_customer", (q) => q.eq("customerId", customer._id))
          .collect();
        const totalBilled = transactions.reduce((sum, t) => sum + t.totalAmount, 0);

        // Get total payments
        const payments = await ctx.db
          .query("payments")
          .withIndex("by_customer", (q) => q.eq("customerId", customer._id))
          .collect();
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

        return {
          ...customer,
          totalBilled,
          totalPaid,
          due: totalBilled - totalPaid,
        };
      }),
    );

    return result;
  },
});

export const getOne = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer) return null;

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();
    const totalBilled = transactions.reduce((sum, t) => sum + t.totalAmount, 0);

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      ...customer,
      totalBilled,
      totalPaid,
      due: totalBilled - totalPaid,
    };
  },
});

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

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_customer", (q) => q.eq("customerId", customer._id))
      .collect();
    const totalBilled = transactions.reduce((sum, t) => sum + t.totalAmount, 0);

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_customer", (q) => q.eq("customerId", customer._id))
      .collect();
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      ...customer,
      totalBilled,
      totalPaid,
      due: totalBilled - totalPaid,
    };
  },
});

export const update = mutation({
  args: {
    customerId: v.id("customers"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { customerId, ...fields } = args;
    await ctx.db.patch(customerId, fields);
  },
});

// Let a signed-in user register themselves as a customer of a business
export const linkToBusiness = mutation({
  args: {
    businessId: v.id("businesses"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if already linked to any business
    const existing = await ctx.db
      .query("customers")
      .withIndex("by_linked_user", (q) => q.eq("linkedUserId", userId))
      .first();
    if (existing) throw new Error("You are already connected to a business.");

    const id = await ctx.db.insert("customers", {
      businessId: args.businessId,
      name: args.name,
      linkedUserId: userId,
    });

    // Update user role
    await ctx.db.patch(userId, { role: "customer" });

    return id;
  },
});
