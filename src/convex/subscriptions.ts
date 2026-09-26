import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getBusinessForUser, getCustomerForUser, notify, istTodayString } from "./lib/helpers";
import { internal } from "./_generated/api";

// ---------------------------------------------------------------- date math

function toUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const d = toUTC(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return fromUTC(target);
}

function addStep(dateStr: string, freq: "daily" | "weekly" | "monthly"): string {
  if (freq === "daily") return addDays(dateStr, 1);
  if (freq === "weekly") return addDays(dateStr, 7);
  return addMonths(dateStr, 1);
}

// ---------------------------------------------------------------- user CRUD

/**
 * Vendor creates a subscription. Quantity/rate snapshot at generation time,
 * not creation time, so price changes apply to future purchases only.
 */
export const create = mutation({
  args: {
    customerId: v.id("customers"),
    productId: v.id("products"),
    quantity: v.number(),
    frequency: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    startDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const business = await getBusinessForUser(ctx, userId);
    if (!business) throw new Error("Business not found");

    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.businessId !== business._id) {
      throw new Error("Customer not found in your business");
    }

    const product = await ctx.db.get(args.productId);
    if (!product || product.businessId !== business._id) {
      throw new Error("Product not found in your business");
    }
    if (product.active === false) {
      throw new Error("Disabled products can't be used for new subscriptions");
    }
    if (!(args.quantity > 0)) throw new Error("Quantity must be greater than zero");

    const startDate = args.startDate ?? istTodayString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("Invalid start date");

    const id = await ctx.db.insert("subscriptions", {
      businessId: business._id,
      customerId: args.customerId,
      productId: args.productId,
      quantity: args.quantity,
      frequency: args.frequency,
      startDate,
      status: "active",
      createdBy: userId,
    });

    if (customer.linkedUserId) {
      await notify(ctx, {
        userId: customer.linkedUserId,
        type: "subscription_started",
        title: `Subscription started: ${product.name}`,
        body: `${args.quantity} ${product.unit} ${args.frequency} from ${startDate}`,
        relatedType: "subscription",
        relatedId: id,
      });
    }

    return id;
  },
});

/** Vendor view: all subscriptions for my business. */
export const getMyBusiness = query({
  args: {
    status: v.optional(v.union(v.literal("active"), v.literal("paused"), v.literal("ended"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const business = await getBusinessForUser(ctx, userId);
    if (!business) return [];

    let rows = await ctx.db
      .query("subscriptions")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    if (args.status) rows = rows.filter((s) => s.status === args.status);

    return await Promise.all(
      rows.map(async (s) => {
        const customer = await ctx.db.get(s.customerId);
        const product = await ctx.db.get(s.productId);
        return {
          ...s,
          customerName: customer?.name ?? "Unknown",
          productName: product?.name ?? "Unknown",
          productUnit: product?.unit ?? "",
          productActive: product?.active ?? false,
          productPrice: product?.price ?? 0,
        };
      }),
    );
  },
});

/** Customer view: subscriptions on my account. */
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const customer = await getCustomerForUser(ctx, userId);
    if (!customer) return [];

    const rows = await ctx.db
      .query("subscriptions")
      .withIndex("by_customer", (q) => q.eq("customerId", customer._id))
      .collect();

    return await Promise.all(
      rows.map(async (s) => {
        const product = await ctx.db.get(s.productId);
        return {
          ...s,
          productName: product?.name ?? "Unknown",
          productUnit: product?.unit ?? "",
          productPrice: product?.price ?? 0,
        };
      }),
    );
  },
});

export const update = mutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    quantity: v.optional(v.number()),
    frequency: v.optional(v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"))),
    productId: v.optional(v.id("products")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const business = await getBusinessForUser(ctx, userId);
    if (!business) throw new Error("Business not found");

    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub || sub.businessId !== business._id) throw new Error("Subscription not found");

    const patch: {
      quantity?: number;
      frequency?: "daily" | "weekly" | "monthly";
      productId?: typeof args.productId;
    } = {};
    if (args.quantity !== undefined) {
      if (!(args.quantity > 0)) throw new Error("Quantity must be greater than zero");
      patch.quantity = args.quantity;
    }
    if (args.frequency !== undefined) patch.frequency = args.frequency;
    if (args.productId !== undefined) {
      const product = await ctx.db.get(args.productId);
      if (!product || product.businessId !== business._id) {
        throw new Error("Product not found in your business");
      }
      if (product.active === false) {
        throw new Error("Disabled products can't be used for subscriptions");
      }
      patch.productId = args.productId;
    }
    if (Object.keys(patch).length > 0) await ctx.db.patch(args.subscriptionId, patch);
    return await ctx.db.get(args.subscriptionId);
  },
});

export const pause = mutation({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const business = await getBusinessForUser(ctx, userId);
    if (!business) throw new Error("Business not found");

    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub || sub.businessId !== business._id) throw new Error("Subscription not found");
    if (sub.status !== "active") throw new Error("Only active subscriptions can be paused");

    await ctx.db.patch(args.subscriptionId, { status: "paused" });
    const product = await ctx.db.get(sub.productId);
    const customer = await ctx.db.get(sub.customerId);
    if (customer?.linkedUserId) {
      await notify(ctx, {
        userId: customer.linkedUserId,
        type: "subscription_paused",
        title: `Subscription paused: ${product?.name ?? "item"}`,
        relatedType: "subscription",
        relatedId: args.subscriptionId,
      });
    }
  },
});

export const resume = mutation({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const business = await getBusinessForUser(ctx, userId);
    if (!business) throw new Error("Business not found");

    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub || sub.businessId !== business._id) throw new Error("Subscription not found");
    if (sub.status !== "paused") throw new Error("Only paused subscriptions can be resumed");

    await ctx.db.patch(args.subscriptionId, { status: "active" });
    const product = await ctx.db.get(sub.productId);
    const customer = await ctx.db.get(sub.customerId);
    if (customer?.linkedUserId) {
      await notify(ctx, {
        userId: customer.linkedUserId,
        type: "subscription_resumed",
        title: `Subscription resumed: ${product?.name ?? "item"}`,
        relatedType: "subscription",
        relatedId: args.subscriptionId,
      });
    }
  },
});

export const end = mutation({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const business = await getBusinessForUser(ctx, userId);
    if (!business) throw new Error("Business not found");

    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub || sub.businessId !== business._id) throw new Error("Subscription not found");
    if (sub.status === "ended") return;

    await ctx.db.patch(args.subscriptionId, { status: "ended" });
    const product = await ctx.db.get(sub.productId);
    const customer = await ctx.db.get(sub.customerId);
    if (customer?.linkedUserId) {
      await notify(ctx, {
        userId: customer.linkedUserId,
        type: "subscription_ended",
        title: `Subscription ended: ${product?.name ?? "item"}`,
        body: "Past purchases remain on your account.",
        relatedType: "subscription",
        relatedId: args.subscriptionId,
      });
    }
  },
});

// ------------------------------------------------------- scheduled generation

/**
 * Internal: generate today's subscription purchases. Idempotent per
 * subscription via lastGeneratedDate — a retried run skips already-generated
 * dates, so no duplicate purchase entries are ever created.
 */
export const generateForToday = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = istTodayString();
    let created = 0;

    const active = await ctx.db
      .query("subscriptions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    for (const sub of active) {
      // Skip when outside schedule window.
      if (sub.startDate > today) continue;
      if (sub.endDate && sub.endDate < today) {
        await ctx.db.patch(sub._id, { status: "ended" });
        continue;
      }

      // Already generated for today? Skip (idempotency guard).
      if (sub.lastGeneratedDate && sub.lastGeneratedDate >= today) continue;

      // Is today a scheduled date since the last run (or start)?
      const anchor = sub.lastGeneratedDate ?? null;
      let due = false;
      if (!anchor) {
        due = sub.startDate <= today;
      } else {
        let cursor = anchor;
        let guard = 0;
        while (cursor < today && guard < 400) {
          cursor = addStep(cursor, sub.frequency);
          guard++;
          if (cursor === today) {
            due = true;
            break;
          }
        }
        // If we fell behind by many periods, still bill today and fast-forward.
        if (!due && guard >= 400) due = true;
      }

      if (!due) continue;

      const product = await ctx.db.get(sub.productId);
      if (!product) continue;

      // Disabled product: skip generation (historical records untouched).
      if (product.active === false) continue;

      const rate = product.price; // current price applies to new purchases
      const totalAmount = Math.round(sub.quantity * rate);

      await ctx.db.insert("transactions", {
        businessId: sub.businessId,
        customerId: sub.customerId,
        productId: sub.productId,
        productName: product.name,
        productUnit: product.unit,
        quantity: sub.quantity,
        rate,
        totalAmount,
        notes: "Subscription purchase",
        date: today,
        recordedBy: sub.createdBy,
        source: "subscription",
        subscriptionId: sub._id,
      });

      await ctx.db.patch(sub._id, { lastGeneratedDate: today });
      created++;
    }

    return created;
  },
});

/** Internal: nudge subscriptions that passed their endDate to ended. */
export const expireSubscriptions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = istTodayString();
    const active = await ctx.db
      .query("subscriptions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    let expired = 0;
    for (const sub of active) {
      if (sub.endDate && sub.endDate < today) {
        await ctx.db.patch(sub._id, { status: "ended" });
        expired++;
      }
    }
    return expired;
  },
});
