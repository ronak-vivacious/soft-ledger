import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getBusinessForUser, getCustomerForUser, notify } from "./lib/helpers";
import { Id } from "./_generated/dataModel";

function randomCode(): string {
  // 6 chars from a 32-symbol alphabet — enough entropy for invite codes.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return code;
}

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

// ---------------------------------------------------------------- vendor side

/** Connection rows for my business, with linked user / customer info. */
export const getByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const business = await ctx.db.get(args.businessId);
    if (!business) throw new Error("Business not found");
    if (business.userId !== userId) throw new Error("Not authorized");

    const connections = await ctx.db
      .query("connections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    return await Promise.all(
      connections.map(async (c) => {
        const customer = c.customerId ? await ctx.db.get(c.customerId) : null;
        const user = c.customerUserId ? await ctx.db.get(c.customerUserId) : null;
        return {
          ...c,
          customerName: customer?.name ?? user?.name ?? null,
          username: user?.username ?? null,
        };
      }),
    );
  },
});

/** The primary pending invite code for my business (for QR/link sharing). */
export const getMyInvite = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const business = await getBusinessForUser(ctx, userId);
    if (!business) return null;

    const connections = await ctx.db
      .query("connections")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    const pending = connections.filter((c) => c.status === "pending" && !c.customerUserId);
    return pending[0] ?? null;
  },
});

/**
 * Invite an existing customer row (or an email) by generating an invite code.
 * The customer row may be an offline customer added earlier; the code links a
 * future signup/acceptance back to that row.
 */
export const createInvite = mutation({
  args: {
    customerId: v.optional(v.id("customers")),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const business = await getBusinessForUser(ctx, userId);
    if (!business) throw new Error("Business not found");

    if (args.customerId) {
      const customer = await ctx.db.get(args.customerId);
      if (!customer || customer.businessId !== business._id) {
        throw new Error("Customer not found");
      }
      // Reuse the newest pending code for this customer if one exists.
      const connections = await ctx.db
        .query("connections")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect();
      const existing = connections.find(
        (c) => c.status === "pending" && c.customerId === args.customerId,
      );
      if (existing) return existing;
    }

    return await ctx.db.insert("connections", {
      businessId: business._id,
      inviteCode: randomCode(),
      customerId: args.customerId,
      status: "pending",
      createdByUserId: userId,
    });
  },
});

/** Vendor finds a customer's account by username and sends a request. */
export const sendVendorRequest = mutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const business = await getBusinessForUser(ctx, userId);
    if (!business) throw new Error("Set up your business first");

    const username = args.username.trim().toLowerCase();
    if (!USERNAME_RE.test(username)) throw new Error("Invalid username");

    const target = await ctx.db
      .query("users")
      .withIndex("username", (q) => q.eq("username", username))
      .first();
    if (!target) throw new Error(`No account with username "${username}"`);
    if (target._id === userId) throw new Error("You can't connect to yourself");

    const bizUsername = business.username;
    if (bizUsername && target.username === bizUsername) {
      throw new Error("You can't connect to yourself");
    }

    const existing = await ctx.db
      .query("connectionRequests")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    const dup = existing.find(
      (r) =>
        r.toUserId === target._id &&
        r.status === "pending" &&
        r.direction === "vendor_to_customer",
    );
    if (dup) throw new Error("Request already pending");

    // If this user is already a connected customer of the business, no request.
    const alreadyCustomer = await ctx.db
      .query("customers")
      .withIndex("by_linked_user", (q) => q.eq("linkedUserId", target._id))
      .first();
    if (alreadyCustomer && alreadyCustomer.businessId === business._id) {
      throw new Error("Already connected");
    }

    await ctx.db.insert("connectionRequests", {
      businessId: business._id,
      fromUserId: userId,
      toUserId: target._id,
      direction: "vendor_to_customer",
      status: "pending",
    });

    await notify(ctx, {
      userId: target._id,
      type: "connection_request",
      title: `${business.name} wants to connect`,
      body: "Open notifications to accept or reject this request.",
      relatedType: "connection",
    });
  },
});

// -------------------------------------------------------------- customer side

/** Customer searches a vendor by username (or via business search) and requests connection. */
export const sendCustomerRequest = mutation({
  args: {
    username: v.optional(v.string()),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const customer = await getCustomerForUser(ctx, userId);
    if (customer) throw new Error("You're already connected to a business");

    let business;
    if (args.businessId) {
      business = await ctx.db.get(args.businessId);
    } else if (args.username) {
      const username = args.username.trim().toLowerCase();
      if (!USERNAME_RE.test(username)) throw new Error("Invalid username");
      business = await ctx.db
        .query("businesses")
        .withIndex("by_username", (q) => q.eq("username", username))
        .first();
    }
    if (!business) throw new Error("No business found for that username");

    const dup = await ctx.db
      .query("connectionRequests")
      .withIndex("by_business", (q) => q.eq("businessId", business!._id))
      .collect();
    if (
      dup.some(
        (r) =>
          r.toUserId === userId &&
          r.status === "pending" &&
          r.direction === "customer_to_vendor",
      )
    ) {
      throw new Error("Request already pending");
    }

    await ctx.db.insert("connectionRequests", {
      businessId: business._id,
      fromUserId: userId,
      toUserId: business.userId,
      direction: "customer_to_vendor",
      status: "pending",
    });

    await notify(ctx, {
      userId: business.userId,
      type: "connection_request",
      title: "New customer connection request",
      body: "Open notifications to accept or reject this request.",
      relatedType: "connection",
    });

    return business.name;
  },
});

/** Incoming pending requests for the signed-in user. */
export const getMyRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const requests = await ctx.db
      .query("connectionRequests")
      .withIndex("by_to_user", (q) => q.eq("toUserId", userId))
      .collect();
    const pending = requests.filter((r) => r.status === "pending");

    return await Promise.all(
      pending.map(async (r) => {
        const business = await ctx.db.get(r.businessId);
        const fromUser = await ctx.db.get(r.fromUserId);
        return {
          _id: r._id,
          direction: r.direction,
          businessName: business?.name ?? "Unknown business",
          fromName: fromUser?.name ?? "Someone",
        };
      }),
    );
  },
});

/** Accept or reject a pending request addressed to me. */
export const respondToRequest = mutation({
  args: { requestId: v.id("connectionRequests"), accept: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");
    if (request.toUserId !== userId) throw new Error("Not authorized");
    if (request.status !== "pending") throw new Error("Request already handled");

    const business = await ctx.db.get(request.businessId);
    if (!business) throw new Error("Business no longer exists");

    if (!args.accept) {
      await ctx.db.patch(request._id, { status: "rejected" });
      await notify(ctx, {
        userId: request.fromUserId,
        type: "connection_rejected",
        title: "Connection request declined",
        relatedType: "connection",
      });
      return { accepted: false };
    }

    await ctx.db.patch(request._id, { status: "accepted" });

    if (request.direction === "vendor_to_customer") {
      // Vendor invited a user → create the customer relationship row.
      const customer = await getCustomerForUser(ctx, userId);
      if (customer && customer.businessId === business._id) {
        // already linked
      } else if (customer) {
        throw new Error("You're already connected to another business");
      } else {
        const user = await ctx.db.get(userId);
        await ctx.db.insert("customers", {
          businessId: business._id,
          name: user?.name ?? "Customer",
          phone: user?.phone,
          linkedUserId: userId,
          active: true,
        });
        await ctx.db.patch(userId, { role: "customer" });
      }
    } else {
      // Customer requested the vendor → vendor accepts; create relationship.
      const fromUser = await ctx.db.get(request.fromUserId);
      const existing = await ctx.db
        .query("customers")
        .withIndex("by_linked_user", (q) => q.eq("linkedUserId", request.fromUserId))
        .first();
      if (!existing) {
        await ctx.db.insert("customers", {
          businessId: business._id,
          name: fromUser?.name ?? "Customer",
          phone: fromUser?.phone,
          linkedUserId: request.fromUserId,
          active: true,
        });
      }
      await ctx.db.patch(request.fromUserId, { role: "customer" });
      await notify(ctx, {
        userId: request.fromUserId,
        type: "connection_accepted",
        title: `${business.name} accepted your request`,
        body: "You can now see their products and your ledger.",
        relatedType: "connection",
      });
    }

    return { accepted: true };
  },
});

// ---------------------------------------------------------------- shared flow

export const getByCode = query({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const code = args.inviteCode.trim().toUpperCase();
    if (!code) return null;
    const connection = await ctx.db
      .query("connections")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", code))
      .first();
    if (!connection) return null;
    const business = await ctx.db.get(connection.businessId);
    return {
      businessName: business?.name ?? "a business",
      status: connection.status,
      alreadyLinkedUserId: connection.customerUserId ?? null,
    };
  },
});

/**
 * Accept an invite code: signed-in user becomes a customer of that business.
 * Idempotent: re-using a used code returns the existing customer instead of
 * creating a duplicate relationship.
 */
export const connectCustomer = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const code = args.inviteCode.trim().toUpperCase();
    const connection = await ctx.db
      .query("connections")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", code))
      .first();
    if (!connection) throw new Error("Invalid invite code");
    const business = await ctx.db.get(connection.businessId);
    if (!business) throw new Error("Business no longer exists");

    // Already linked to this business via this code? Return existing link.
    if (connection.customerUserId === userId) {
      const customer = await getCustomerForUser(ctx, userId);
      if (customer) return customer;
    }
    if (connection.status === "connected" && connection.customerUserId) {
      throw new Error("This invite has already been used");
    }

    const existingForBusiness = await ctx.db
      .query("customers")
      .withIndex("by_linked_user", (q) => q.eq("linkedUserId", userId))
      .first();
    if (existingForBusiness && existingForBusiness.businessId === connection.businessId) {
      return existingForBusiness;
    }
    if (existingForBusiness) {
      throw new Error("You're already connected to another business");
    }

    const user = await ctx.db.get(userId);

    // Reattach the invite to an offline customer row if the vendor pre-created one.
    let customerId: Id<"customers">;
    if (connection.customerId) {
      const offline = await ctx.db.get(connection.customerId);
      if (offline && offline.businessId === connection.businessId && !offline.linkedUserId) {
        await ctx.db.patch(offline._id, {
          linkedUserId: userId,
          phone: offline.phone ?? user?.phone,
          active: true,
        });
        customerId = offline._id;
      } else {
        customerId = await ctx.db.insert("customers", {
          businessId: connection.businessId,
          name: user?.name ?? "Customer",
          phone: user?.phone,
          linkedUserId: userId,
          active: true,
        });
      }
    } else {
      customerId = await ctx.db.insert("customers", {
        businessId: connection.businessId,
        name: user?.name ?? "Customer",
        phone: user?.phone,
        linkedUserId: userId,
        active: true,
      });
    }

    await ctx.db.patch(connection._id, {
      customerUserId: userId,
      status: "connected",
    });
    await ctx.db.patch(userId, { role: "customer" });

    await notify(ctx, {
      userId: business.userId,
      type: "connection_accepted",
      title: `${user?.name ?? "A customer"} connected`,
      body: `They used your invite code ${code}.`,
      relatedType: "customer",
      relatedId: customerId,
    });

    return await ctx.db.get(customerId);
  },
});
