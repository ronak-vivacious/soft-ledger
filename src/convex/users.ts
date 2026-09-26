import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

// Update profile: name, phone, username. Usernames are globally unique and
// immutable once set (they are how people find and connect with you).
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const patch: { name?: string; phone?: string } = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Name cannot be empty");
      patch.name = name;
    }
    if (args.phone !== undefined) {
      const phone = args.phone.trim();
      patch.phone = phone || undefined;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(userId, patch);
    }
    return await ctx.db.get(userId);
  },
});

// Claim a unique username. One-time: it identifies you in connections.
export const claimUsername = mutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const username = args.username.trim().toLowerCase();
    if (!USERNAME_RE.test(username)) {
      throw new Error("Use 3-24 lowercase letters, numbers, or underscores");
    }

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    if (user.username) throw new Error("You already have a username");

    const taken = await ctx.db
      .query("users")
      .withIndex("username", (q) => q.eq("username", username))
      .first();
    if (taken) throw new Error("That username is taken");

    // Also reserve the same handle as a business username if free.
    const bizTaken = await ctx.db
      .query("businesses")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
    if (bizTaken) throw new Error("That username is taken");

    await ctx.db.patch(userId, { username });
    return username;
  },
});

// Find users/businesses by username for connecting. Safe public search:
// returns only what a stranger may see.
export const searchByUsername = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const q = args.query.trim().toLowerCase();
    if (q.length < 2) return { users: [], businesses: [] };

    const users = await ctx.db
      .query("users")
      .withIndex("username", (iq) => iq.eq("username", q))
      .collect();
    const businesses = await ctx.db
      .query("businesses")
      .withIndex("by_username", (iq) => iq.eq("username", q))
      .collect();

    return {
      users: users.slice(0, 5).map((u) => ({
        userId: u._id,
        name: u.name ?? "Unnamed",
        username: u.username ?? "",
      })),
      businesses: businesses.slice(0, 5).map((b) => ({
        businessId: b._id,
        name: b.name,
        username: b.username ?? "",
      })),
    };
  },
});
