import { v } from "convex/values";
import { query } from "./_generated/server";

// Today's summary for vendor dashboard
export const todaySummary = query({
  args: {
    businessId: v.id("businesses"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    // Get today's transactions
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_business_date", (q) =>
        q.eq("businessId", args.businessId).eq("date", args.date),
      )
      .collect();

    // Get today's payments
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_business_date", (q) =>
        q.eq("businessId", args.businessId).eq("date", args.date),
      )
      .collect();

    // Unique customers today
    const uniqueCustomers = new Set(transactions.map((t) => t.customerId));

    // Total quantity
    const totalQuantity = transactions.reduce((sum, t) => sum + t.quantity, 0);

    // Total amount
    const totalAmount = transactions.reduce((sum, t) => sum + t.totalAmount, 0);

    // Total payments today
    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      customerCount: uniqueCustomers.size,
      totalQuantity,
      totalAmount,
      totalPayments,
      transactionCount: transactions.length,
    };
  },
});

// Recent transactions across all customers
export const recentActivity = query({
  args: {
    businessId: v.id("businesses"),
    date: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_business_date", (q) =>
        q.eq("businessId", args.businessId).eq("date", args.date),
      )
      .order("desc")
      .take(args.limit);

    // Enrich with customer and product names
    const result = await Promise.all(
      transactions.map(async (t) => {
        const customer = await ctx.db.get(t.customerId);
        const product = await ctx.db.get(t.productId);
        return {
          ...t,
          customerName: customer?.name || "Unknown",
          productName: product?.name || "Unknown",
          productUnit: product?.unit || "",
        };
      }),
    );

    return result;
  },
});

// Total outstanding across all customers
export const totalOutstanding = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const customers = await ctx.db
      .query("customers")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    let totalDue = 0;

    for (const customer of customers) {
      const transactions = await ctx.db
        .query("transactions")
        .withIndex("by_customer", (q) => q.eq("customerId", customer._id))
        .collect();
      const totalBilled = transactions.reduce((sum, t) => sum + t.totalAmount, 0);

      const payments = await ctx.db
        .query("payments")
        .withIndex("by_customer", (q) => q.eq("customerId", customer._id))
        .collect();
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

      const due = totalBilled - totalPaid;
      if (due > 0) totalDue += due;
    }

    return totalDue;
  },
});

// Monthly summary for vendor
export const monthlySummary = query({
  args: {
    businessId: v.id("businesses"),
    yearMonth: v.string(), // YYYY-MM
  },
  handler: async (ctx, args) => {
    const startDate = `${args.yearMonth}-01`;
    const endDate = `${args.yearMonth}-31`;

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_business_date", (q) =>
        q
          .eq("businessId", args.businessId)
          .gte("date", startDate)
          .lte("date", endDate),
      )
      .collect();

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_business_date", (q) =>
        q
          .eq("businessId", args.businessId)
          .gte("date", startDate)
          .lte("date", endDate),
      )
      .collect();

    const totalBilled = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      totalBilled,
      totalPaid,
      due: totalBilled - totalPaid,
      transactionCount: transactions.length,
      paymentCount: payments.length,
    };
  },
});
