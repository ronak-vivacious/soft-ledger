import { v } from "convex/values";
import { query } from "./_generated/server";

// Monthly summary for a specific customer
export const customerMonthlySummary = query({
  args: {
    customerId: v.id("customers"),
    yearMonth: v.string(), // YYYY-MM
  },
  handler: async (ctx, args) => {
    const startDate = `${args.yearMonth}-01`;
    const endDate = `${args.yearMonth}-31`;

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_customer_date", (q) =>
        q
          .eq("customerId", args.customerId)
          .gte("date", startDate)
          .lte("date", endDate),
      )
      .collect();

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_customer_date", (q) =>
        q
          .eq("customerId", args.customerId)
          .gte("date", startDate)
          .lte("date", endDate),
      )
      .collect();

    // Group transactions by product
    const productMap = new Map<string, { quantity: number; amount: number }>();

    for (const t of transactions) {
      const product = await ctx.db.get(t.productId);
      const key = product?.name || "Unknown";
      const existing = productMap.get(key) || { quantity: 0, amount: 0 };
      productMap.set(key, {
        quantity: existing.quantity + t.quantity,
        amount: existing.amount + t.totalAmount,
      });
    }

    const productSummary = Array.from(productMap.entries()).map(
      ([name, data]) => ({
        name,
        quantity: data.quantity,
        amount: data.amount,
      }),
    );

    const totalBilled = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      totalBilled,
      totalPaid,
      due: totalBilled - totalPaid,
      products: productSummary,
      transactions,
      payments,
    };
  },
});

// Get the business name for a customer
export const businessForCustomer = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer) return null;

    const business = await ctx.db.get(customer.businessId);
    return business;
  },
});
