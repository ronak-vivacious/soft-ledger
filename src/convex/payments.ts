import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getBusinessForUser, getCustomerForUser, notify, istTodayString } from "./lib/helpers";

function formatRupees(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

const METHODS = ["cash", "upi", "bank", "other"];

/**
 * Record an offline payment. Either side can record; it lands as "pending"
 * until the OTHER side verifies. Never directly "confirmed" — that is the core
 * anti-fraud rule. Duplicate submissions of the exact same amount+date+method
 * within a minute are rejected (retry safety).
 */
export const create = mutation({
  args: {
    customerId: v.id("customers"),
    amount: v.number(), // paise, positive
    method: v.string(),
    notes: v.optional(v.string()),
    date: v.optional(v.string()), // YYYY-MM-DD; default today IST
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (!(args.amount > 0)) throw new Error("Amount must be greater than zero");
    if (!METHODS.includes(args.method)) throw new Error("Invalid payment method");

    const date = args.date ?? istTodayString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");

    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("Customer not found");
    const business = await ctx.db.get(customer.businessId);
    if (!business) throw new Error("Business not found");

    // Authorization: vendor owner OR the linked customer themselves.
    const isVendor = business.userId === userId;
    const isCustomer = customer.linkedUserId === userId;
    if (!isVendor && !isCustomer) throw new Error("Not authorized");
    if (isCustomer && customer.active === false) {
      throw new Error("This account is inactive");
    }

    // Duplicate guard: same amount/date/method/customer recorded within the
    // last 60 seconds by anyone — likely a double-tap or retried request.
    const recent = await ctx.db
      .query("payments")
      .withIndex("by_customer_date", (q) =>
        q.eq("customerId", args.customerId).eq("date", date),
      )
      .collect();
    if (
      recent.some(
        (p) =>
          p.amount === args.amount &&
          p.method === args.method &&
          Date.now() - p._creationTime < 60_000,
      )
    ) {
      throw new Error("This payment was just recorded — check history before retrying");
    }

    const id = await ctx.db.insert("payments", {
      businessId: customer.businessId,
      customerId: args.customerId,
      amount: Math.round(args.amount),
      method: args.method,
      notes: args.notes?.trim() || undefined,
      date,
      recordedBy: userId,
      recordedByRole: isVendor ? "vendor" : "customer",
      status: "pending",
    });

    // Notify the OTHER side to verify.
    if (isVendor && customer.linkedUserId) {
      await notify(ctx, {
        userId: customer.linkedUserId,
        type: "payment_verify_request",
        title: `Verify payment: ${formatRupees(args.amount)}`,
        body: `${business.name} recorded a ${args.method} payment. Confirm or dispute it.`,
        relatedType: "payment",
        relatedId: id,
      });
    } else if (isCustomer) {
      await notify(ctx, {
        userId: business.userId,
        type: "payment_verify_request",
        title: `Verify payment: ${formatRupees(args.amount)}`,
        body: `${customer.name} recorded a ${args.method} payment. Confirm or dispute it.`,
        relatedType: "payment",
        relatedId: id,
      });
    }

    return id;
  },
});

/** Verify or reject a pending payment. Only the NON-recorder can act. */
export const verify = mutation({
  args: {
    paymentId: v.id("payments"),
    decision: v.union(v.literal("confirmed"), v.literal("rejected")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error("Payment not found");
    if (payment.status !== "pending") {
      throw new Error("Only pending payments can be verified");
    }

    const customer = await ctx.db.get(payment.customerId);
    if (!customer) throw new Error("Customer not found");
    const business = await ctx.db.get(payment.businessId);
    if (!business) throw new Error("Business not found");

    const isVendor = business.userId === userId;
    const isCustomer = customer.linkedUserId === userId;
    if (!isVendor && !isCustomer) throw new Error("Not authorized");

    // The recorder can never verify their own payment.
    if (payment.recordedBy === userId) {
      throw new Error("The person who recorded a payment can't verify it");
    }

    await ctx.db.patch(payment._id, {
      status: args.decision,
      verifiedBy: userId,
      verifiedAt: Date.now(),
    });

    const whoVerified = isVendor ? business.name : customer.name;
    const base = {
      relatedType: "payment",
      relatedId: payment._id,
    };

    if (args.decision === "confirmed") {
      await notify(ctx, {
        userId: payment.recordedBy,
        type: "payment_confirmed",
        title: `Payment confirmed: ${formatRupees(payment.amount)}`,
        body: `Verified by ${whoVerified}`,
        ...base,
      });
    } else {
      // Dispute: tell the recorder, and let the other side know too.
      await notify(ctx, {
        userId: payment.recordedBy,
        type: "payment_rejected",
        title: `Payment disputed: ${formatRupees(payment.amount)}`,
        body: args.note?.trim() || `${whoVerified} disputed this payment. Balance is unaffected until resolved.`,
        ...base,
      });
      const otherId = isVendor ? customer.linkedUserId : business.userId;
      if (otherId && otherId !== payment.recordedBy) {
        await notify(ctx, {
          userId: otherId,
          type: "payment_rejected",
          title: `Payment disputed: ${formatRupees(payment.amount)}`,
          body: args.note?.trim() || "A recorded payment was disputed.",
          ...base,
        });
      }
    }

    return { status: args.decision };
  },
});

/**
 * Reverse a CONFIRMED payment (wrong amount, duplicate, etc.). Creates an
 * audit trail on the original record; the payment stops counting toward the
 * balance but is never deleted or silently edited.
 */
export const reverse = mutation({
  args: {
    paymentId: v.id("payments"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error("Payment not found");
    if (payment.status !== "confirmed") {
      throw new Error("Only confirmed payments can be reversed");
    }
    if (payment.reversed) throw new Error("Payment already reversed");

    const customer = await ctx.db.get(payment.customerId);
    if (!customer) throw new Error("Customer not found");
    const business = await ctx.db.get(payment.businessId);
    if (!business) throw new Error("Business not found");

    const isVendor = business.userId === userId;
    const isCustomer = customer.linkedUserId === userId;
    if (!isVendor && !isCustomer) throw new Error("Not authorized");

    await ctx.db.patch(payment._id, {
      reversed: true,
      reversedAt: Date.now(),
      reversedBy: userId,
      reversalNote: args.note?.trim() || "Reversed",
    });

    const note = args.note?.trim() || "No reason given";
    const base = { relatedType: "payment", relatedId: payment._id };
    await notify(ctx, {
      userId: payment.recordedBy,
      type: "payment_reversed",
      title: `Payment reversed: ${formatRupees(payment.amount)}`,
      body: note,
      ...base,
    });
    const otherId = isVendor ? customer.linkedUserId : business.userId;
    if (otherId && otherId !== payment.recordedBy) {
      await notify(ctx, {
        userId: otherId,
        type: "payment_reversed",
        title: `Payment reversed: ${formatRupees(payment.amount)}`,
        body: note,
        ...base,
      });
    }

    return { reversed: true };
  },
});

/** Payments for a customer — vendor owner or the linked customer only. */
export const getByCustomer = query({
  args: {
    customerId: v.id("customers"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("pending"), v.literal("confirmed"), v.literal("rejected")),
    ),
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

    let payments = await ctx.db
      .query("payments")
      .withIndex("by_customer_date", (q) =>
        args.startDate
          ? q.eq("customerId", args.customerId).gte("date", args.startDate)
          : q.eq("customerId", args.customerId),
      )
      .collect();

    if (args.endDate) payments = payments.filter((p) => p.date <= args.endDate!);
    if (args.status) payments = payments.filter((p) => p.status === args.status);

    return payments.sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : b._creationTime - a._creationTime,
    );
  },
});

/** Payments awaiting MY verification (i.e. recorded by the other side). */
export const getPendingForMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const business = await getBusinessForUser(ctx, userId);
    const customer = await getCustomerForUser(ctx, userId);
    let payments: Array<{
      _id: string;
      amount: number;
      method: string;
      date: string;
      status: "pending" | "confirmed" | "rejected";
      recordedByRole: "vendor" | "customer";
      customerId: string;
      customerName?: string;
      businessName?: string;
      notes?: string;
    }> = [];

    if (business) {
      const rows = await ctx.db
        .query("payments")
        .withIndex("by_business_date", (q) => q.eq("businessId", business._id))
        .collect();
      payments = await Promise.all(
        rows
          .filter((p) => p.status === "pending" && p.recordedBy !== userId)
          .map(async (p) => {
            const c = await ctx.db.get(p.customerId);
            return {
              _id: p._id,
              amount: p.amount,
              method: p.method,
              date: p.date,
              status: p.status,
              recordedByRole: p.recordedByRole,
              customerId: p.customerId,
              customerName: c?.name,
              notes: p.notes,
            };
          }),
      );
    } else if (customer) {
      const rows = await ctx.db
        .query("payments")
        .withIndex("by_customer_date", (q) => q.eq("customerId", customer._id))
        .collect();
      payments = rows
        .filter((p) => p.status === "pending" && p.recordedBy !== userId)
        .map((p) => ({
          _id: p._id,
          amount: p.amount,
          method: p.method,
          date: p.date,
          status: p.status,
          recordedByRole: p.recordedByRole,
          customerId: p.customerId,
          businessName: undefined,
          notes: p.notes,
        }));
      if (payments.length > 0) {
        const biz = await ctx.db.get(customer.businessId);
        payments = payments.map((p) => ({ ...p, businessName: biz?.name }));
      }
    }

    return payments.sort((a, b) => (a.date < b.date ? 1 : -1));
  },
});
