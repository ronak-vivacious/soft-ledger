import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if business already exists
    const existing = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing._id;

    const id = await ctx.db.insert("businesses", {
      userId,
      name: args.name,
      phone: args.phone,
    });

    // Create default products
    await ctx.db.insert("products", {
      businessId: id,
      name: "Milk",
      unit: "Litre",
      price: 6000, // ₹60 in paise
    });
    await ctx.db.insert("products", {
      businessId: id,
      name: "Tea",
      unit: "Cup",
      price: 1600, // ₹16 in paise
    });

    // Create default connection
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await ctx.db.insert("connections", {
      businessId: id,
      inviteCode: code,
      status: "pending",
    });

    // Update user role
    await ctx.db.patch(userId, { role: "vendor" });

    return id;
  },
});

export const getByUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});
