import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

export const create = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    username: v.optional(v.string()),
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

    // Optionally claim a business username (globally unique)
    let username: string | undefined;
    if (args.username) {
      username = args.username.trim().toLowerCase();
      if (!USERNAME_RE.test(username)) {
        throw new Error("Use 3-24 lowercase letters, numbers, or underscores");
      }
      const takenByUser = await ctx.db
        .query("users")
        .withIndex("username", (q) => q.eq("username", username!))
        .first();
      const takenByBiz = await ctx.db
        .query("businesses")
        .withIndex("by_username", (q) => q.eq("username", username!))
        .first();
      if (takenByUser || takenByBiz) {
        throw new Error("That username is taken");
      }
    }

    const id = await ctx.db.insert("businesses", {
      userId,
      name: args.name,
      phone: args.phone,
      username,
    });

    // Create a starter product (the owner can add more later)
    await ctx.db.insert("products", {
      businessId: id,
      name: "Item",
      unit: "Unit",
      price: 1000, // ₹10 in paise — a placeholder rate
      active: true,
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

export const update = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    username: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) throw new Error("Business not found");

    const patch: { name?: string; phone?: string; username?: string } = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Name cannot be empty");
      patch.name = name;
    }
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (args.username !== undefined) {
      if (business.username) throw new Error("Username already set");
      const username = args.username.trim().toLowerCase();
      if (!USERNAME_RE.test(username)) {
        throw new Error("Use 3-24 lowercase letters, numbers, or underscores");
      }
      const takenByUser = await ctx.db
        .query("users")
        .withIndex("username", (q) => q.eq("username", username))
        .first();
      const takenByBiz = await ctx.db
        .query("businesses")
        .withIndex("by_username", (q) => q.eq("username", username))
        .first();
      if (takenByUser || takenByBiz) throw new Error("That username is taken");
      patch.username = username;
    }

    if (Object.keys(patch).length > 0) await ctx.db.patch(business._id, patch);
    return await ctx.db.get(business._id);
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
