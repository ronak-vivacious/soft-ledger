import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("connections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();
  },
});

export const getByCode = query({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("connections")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", args.inviteCode))
      .first();
  },
});

export const createInvite = mutation({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    return await ctx.db.insert("connections", {
      businessId: args.businessId,
      inviteCode: code,
      status: "pending",
    });
  },
});

export const connectCustomer = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const connection = await ctx.db
      .query("connections")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", args.inviteCode))
      .first();

    if (!connection) throw new Error("Invalid invite code");
    if (connection.status === "connected") throw new Error("This invite has already been used");

    // Create customer record linked to this user
    const customer = await ctx.db.insert("customers", {
      businessId: connection.businessId,
      name: (await ctx.db.get(userId))?.name || "Customer",
      linkedUserId: userId,
    });

    // Update connection
    await ctx.db.patch(connection._id, {
      customerUserId: userId,
      status: "connected",
    });

    // Update user role
    await ctx.db.patch(userId, { role: "customer" });

    return customer;
  },
});
