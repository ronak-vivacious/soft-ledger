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

    // Create a starter product (the owner can add more later)
    await ctx.db.insert("products", {
      businessId: id,
      name: "Item",
      unit: "Unit",
      price: 1000, // ₹10 in paise — a placeholder rate
    });

    // Create default connection
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await ctx.db.insert("connections", {
      businessId: id,
      inviteCode: code,
      status: "pending",
    });

    // Mark the user as a business owner
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

// Search businesses by name (for customers looking to connect)
export const searchByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("businesses").collect();
    const query = args.name.toLowerCase().trim();
    return all
      .filter((b) => b.name.toLowerCase().includes(query))
      .map((b) => ({ _id: b._id, name: b.name }))
      .slice(0, 10);
  },
});
