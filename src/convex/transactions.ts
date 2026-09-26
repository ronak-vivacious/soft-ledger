import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getBusinessForUser, notify, safeMoney, istTodayString } from "./lib/helpers";

function formatRupees(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

/**
 * Vendor records a purchase. Product name/unit/rate are snapshotted so history
 * stays accurate even if the product is later edited or disabled. Only active
 * products can be used for new purchases.
 */
export const create = mutation({
  args: {
    customerId: v.id("customers"),
    productId: v.id("products"),
    quantity: v.number(),
    notes: v.optional(v.string()),
    date: v.optional(v.string()), // YYYY-MM-DD; defaults to today (IST)
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
      throw new Error("This product is disabled — enable it to record purchases");
    }

    if (!(args.quantity > 0)) throw new Error("Quantity must be greater than zero");

    const date = args.date ?? istTodayString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");

    const rate = product.price;
    const totalAmount = safeMoney(args.quantity * rate);

    const id = await ctx.db.insert("transactions", {
      businessId: business._id,
      customerId: args.customerId,
      productId: args.productId,
      productName: product.name,
      productUnit: product.unit,
      quantity: args.quantity,
      rate,
      totalAmount,
      notes: args.notes?.trim() || undefined,
      date,
      recordedBy: userId,
      source: "single",
    });

    if (customer.linkedUserId) {
      await notify(ctx, {
        userId: customer.linkedUserId,
        type: "purchase",
        title: `New purchase: ${product.name}`,
        body: `${args.quantity} ${product.unit} · ${formatRupees(totalAmount)}`,
        relatedType: "customer",
        relatedId: args.customerId,
      });
    }

    return id;
  },
});

type TxFilter = {
  customerId: string;
  startDate?: string;
  endDate?: string;
  productId?: string;
  source?: "single" | "subscription";
};

/** Loads and filters transactions for a customer, newest first. Shared logic. */
async function filteredTransactions(
  ctx: QueryCtx,
  args: TxFilter,
) {
  let txs = await ctx.db
    .query("transactions")
    .withIndex("by_customer_date", (q) =>
      args.startDate
        ? q.eq("customerId", args.customerId as never).gte("date", args.startDate)
        : q.eq("customerId", args.customerId as never),
    )
    .collect();

  if (args.endDate) txs = txs.filter((t) => t.date <= args.endDate!);
  if (args.productId) txs = txs.filter((t) => t.productId === args.productId);
  if (args.source) txs = txs.filter((t) => t.source === args.source);

  return txs.sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : b._creationTime - a._creationTime,
  );
}

/** Transactions for one customer — vendor owner or the linked customer only. */
export const getByCustomer = query({
  args: {
    customerId: v.id("customers"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    productId: v.optional(v.id("products")),
    source: v.optional(v.union(v.literal("single"), v.literal("subscription"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("Customer not found");
    const business = await ctx.db.get(customer.businessId);
    if (!business) throw new Error("Business not found");
    if (business.userId !== userId && customer.linkedUserId !== userId) {
      throw new Error("Not authorized");
    }

    return filteredTransactions(ctx, args);
  },
});

/** Transactions for the signed-in customer's own account. */
export const getMine = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    productId: v.optional(v.id("products")),
    source: v.optional(v.union(v.literal("single"), v.literal("subscription"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const customer = await ctx.db
      .query("customers")
      .withIndex("by_linked_user", (q) => q.eq("linkedUserId", userId))
      .first();
    if (!customer) return [];

    return filteredTransactions(ctx, { ...args, customerId: customer._id });
  },
});

/** All transactions across my business (vendor activity feed). */
export const getMyBusiness = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const business = await getBusinessForUser(ctx, userId);
    if (!business) return [];

    let txs = await ctx.db
      .query("transactions")
      .withIndex("by_business_date", (q) =>
        args.startDate
          ? q.eq("businessId", business._id).gte("date", args.startDate)
          : q.eq("businessId", business._id),
      )
      .collect();
    if (args.endDate) txs = txs.filter((t) => t.date <= args.endDate!);

    return txs.sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : b._creationTime - a._creationTime,
    );
  },
});

/**
 * Correction flow: instead of deleting confirmed financial history, the vendor
 * records a reversal — a negative transaction referencing the original.
 */
export const reverse = mutation({
  args: {
    transactionId: v.id("transactions"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const original = await ctx.db.get(args.transactionId);
    if (!original) throw new Error("Transaction not found");
    const business = await ctx.db.get(original.businessId);
    if (!business) throw new Error("Business not found");
    if (business.userId !== userId) throw new Error("Only the business owner can reverse a purchase");

    // Guard against double reversal of the same record.
    const existing = await ctx.db
      .query("transactions")
      .withIndex("by_customer", (q) => q.eq("customerId", original.customerId))
      .collect();
    if (existing.some((t) => t.reversalOfTransactionId === original._id)) {
      throw new Error("This purchase is already reversed");
    }

    const id = await ctx.db.insert("transactions", {
      businessId: original.businessId,
      customerId: original.customerId,
      productId: original.productId,
      productName: original.productName ?? "Reversal",
      productUnit: original.productUnit,
      quantity: -original.quantity,
      rate: original.rate,
      totalAmount: -original.totalAmount,
      notes: args.reason?.trim() || "Reversal of recorded purchase",
      date: istTodayString(),
      recordedBy: userId,
      source: original.source,
      subscriptionId: original.subscriptionId,
      reversalOfTransactionId: original._id,
    });

    const customer = await ctx.db.get(original.customerId);
    if (customer?.linkedUserId) {
      await notify(ctx, {
        userId: customer.linkedUserId,
        type: "transaction_reversed",
        title: `Purchase reversed: ${original.productName ?? "item"}`,
        body: `−${formatRupees(original.totalAmount)} removed from your account`,
        relatedType: "customer",
        relatedId: original.customerId,
      });
    }

    return id;
  },
});
