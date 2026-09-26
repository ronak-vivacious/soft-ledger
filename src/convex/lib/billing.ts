import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import {
  istTodayString,
  previousYearMonth,
  lastDayOfMonth,
  customerTotals,
  notify,
} from "./helpers";

/**
 * Internal: generate monthly statements for the prior month for every
 * vendor-customer pair that had activity. Idempotent per pair+month.
 */
export const generateMonthlyBills = internalMutation({
  args: {},
  handler: async (ctx) => {
    const yearMonth = previousYearMonth(istTodayString());
    const startDate = `${yearMonth}-01`;
    const endDate = lastDayOfMonth(yearMonth);

    const customers = await ctx.db.query("customers").collect();
    let generated = 0;

    for (const customer of customers) {
      const existing = await ctx.db
        .query("monthlyBills")
        .withIndex("by_customer_month", (q) =>
          q.eq("customerId", customer._id).eq("yearMonth", yearMonth),
        )
        .first();
      if (existing) continue; // idempotency guard

      const opening = await customerTotals(ctx, customer._id, {
        untilDate: dayBefore(startDate),
      });
      const monthTotals = await statementForRange(ctx, customer._id, startDate, endDate);

      // Only generate a statement if there was activity or an outstanding balance.
      if (monthTotals.totalBilled === 0 && monthTotals.confirmedPayments === 0 && opening.due === 0) {
        continue;
      }

      const closingBalance =
        opening.due + monthTotals.totalBilled - monthTotals.confirmedPayments;

      await ctx.db.insert("monthlyBills", {
        businessId: customer.businessId,
        customerId: customer._id,
        yearMonth,
        openingBalance: opening.due,
        totalBilled: monthTotals.totalBilled,
        confirmedPayments: monthTotals.confirmedPayments,
        closingBalance,
        generatedAt: Date.now(),
      });

      generated++;

      if (customer.linkedUserId) {
        await notify(ctx, {
          userId: customer.linkedUserId,
          type: "bill_generated",
          title: `Monthly statement ready: ${yearMonth}`,
          body: formatRupees(closingBalance) + " balance after this month",
          relatedType: "bill",
          relatedId: `${customer._id}:${yearMonth}`,
        });
      }
    }

    return generated;
  },
});

/**
 * Internal: daily payment reminders. Every 3 days, notify customers with an
 * outstanding balance and vendors with pending verifications. Keeps email /
 * notification volume low.
 */
export const sendPaymentReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = istTodayString();
    const day = Number(today.slice(8, 10));
    if (day % 3 !== 1) return 0; // run on the 1st, 4th, 7th ... of each month

    const customers = await ctx.db.query("customers").collect();
    let sent = 0;

    for (const customer of customers) {
      const totals = await customerTotals(ctx, customer._id);
      if (totals.due > 0 && customer.linkedUserId) {
        await notify(ctx, {
          userId: customer.linkedUserId,
          type: "payment_reminder",
          title: `Outstanding balance: ${formatRupees(totals.due)}`,
          body: "Open your dashboard to review and record a payment.",
          relatedType: "customer",
          relatedId: customer._id,
        });
        sent++;
      }
    }

    // Vendors: remind about payments waiting for their verification.
    const businesses = await ctx.db.query("businesses").collect();
    for (const business of businesses) {
      const payments = await ctx.db
        .query("payments")
        .withIndex("by_business_date", (q) => q.eq("businessId", business._id))
        .collect();
      const pending = payments.filter((p) => p.status === "pending" && !p.reversed);
      if (pending.length > 0) {
        await notify(ctx, {
          userId: business.userId,
          type: "verification_reminder",
          title: `${pending.length} payment${pending.length === 1 ? "" : "s"} need verification`,
          body: "Confirm or dispute recorded payments to keep balances accurate.",
        });
        sent++;
      }
    }

    return sent;
  },
});

// ---------------------------------------------------------------- utilities

function dayBefore(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return dt.toISOString().split("T")[0];
}

async function statementForRange(
  ctx: MutationCtx,
  customerId: Id<"customers">,
  startDate: string,
  endDate: string,
) {
  const txs = await ctx.db
    .query("transactions")
    .withIndex("by_customer_date", (q) =>
      q.eq("customerId", customerId).gte("date", startDate).lte("date", endDate),
    )
    .collect();
  const pays = await ctx.db
    .query("payments")
    .withIndex("by_customer_date", (q) =>
      q.eq("customerId", customerId).gte("date", startDate).lte("date", endDate),
    )
    .collect();

  return {
    totalBilled: txs.reduce((s, t) => s + t.totalAmount, 0),
    confirmedPayments: pays
      .filter((p) => p.status === "confirmed" && !p.reversed)
      .reduce((s, p) => s + p.amount, 0),
  };
}

function formatRupees(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
