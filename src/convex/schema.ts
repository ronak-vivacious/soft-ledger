import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema(
  {
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(v.union(v.literal("vendor"), v.literal("customer"))),
    }).index("email", ["email"]),

    // Vendor's business profile
    businesses: defineTable({
      userId: v.id("users"),
      name: v.string(),
      phone: v.optional(v.string()),
    }).index("by_user", ["userId"]),

    // Customers belonging to a business
    customers: defineTable({
      businessId: v.id("businesses"),
      name: v.string(),
      phone: v.optional(v.string()),
      linkedUserId: v.optional(v.id("users")),
    }).index("by_business", ["businessId"])
      .index("by_linked_user", ["linkedUserId"]),

    // Products offered by a business
    products: defineTable({
      businessId: v.id("businesses"),
      name: v.string(),
      unit: v.string(),
      price: v.number(), // price per unit in paise
    }).index("by_business", ["businessId"]),

    // Transaction / delivery records
    transactions: defineTable({
      businessId: v.id("businesses"),
      customerId: v.id("customers"),
      productId: v.id("products"),
      quantity: v.number(),
      rate: v.number(), // rate at time of transaction in paise
      totalAmount: v.number(), // quantity * rate in paise
      notes: v.optional(v.string()),
      date: v.string(), // YYYY-MM-DD
      recordedBy: v.id("users"),
    }).index("by_business_date", ["businessId", "date"])
      .index("by_customer", ["customerId"])
      .index("by_customer_date", ["customerId", "date"]),

    // Payment records
    payments: defineTable({
      businessId: v.id("businesses"),
      customerId: v.id("customers"),
      amount: v.number(), // in paise
      method: v.string(), // "cash", "upi", "bank", "other"
      notes: v.optional(v.string()),
      date: v.string(), // YYYY-MM-DD
      recordedBy: v.id("users"),
    }).index("by_business_date", ["businessId", "date"])
      .index("by_customer", ["customerId"])
      .index("by_customer_date", ["customerId", "date"]),

    // Vendor-customer connections via invite code
    connections: defineTable({
      businessId: v.id("businesses"),
      inviteCode: v.string(),
      customerUserId: v.optional(v.id("users")),
      status: v.union(v.literal("pending"), v.literal("connected")),
    }).index("by_invite_code", ["inviteCode"])
      .index("by_business", ["businessId"])
      .index("by_customer_user", ["customerUserId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
