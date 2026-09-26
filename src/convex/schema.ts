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
      phone: v.optional(v.string()),
      username: v.optional(v.string()), // globally unique, lowercase
    }).index("email", ["email"]).index("username", ["username"]),

    // Vendor's business profile
    businesses: defineTable({
      userId: v.id("users"),
      name: v.string(),
      phone: v.optional(v.string()),
      username: v.optional(v.string()), // unique, shared namespace with users.username
    }).index("by_user", ["userId"]).index("by_username", ["username"]),

    // Customers belonging to a business (one row per business-customer
    // relationship). linkedUserId is set when the customer has an account.
    customers: defineTable({
      businessId: v.id("businesses"),
      name: v.string(),
      phone: v.optional(v.string()),
      linkedUserId: v.optional(v.id("users")),
      active: v.optional(v.boolean()), // relationship active/inactive
    }).index("by_business", ["businessId"])
      .index("by_linked_user", ["linkedUserId"]),

    // Products offered by a business. Disabled products stay for history.
    products: defineTable({
      businessId: v.id("businesses"),
      name: v.string(),
      description: v.optional(v.string()),
      unit: v.string(),
      price: v.number(), // price per unit in paise
      active: v.optional(v.boolean()),
    }).index("by_business", ["businessId"]),

    // Transaction / delivery records. Historical: product name/unit/rate are
    // snapshotted at purchase time and records are never silently mutated.
    transactions: defineTable({
      businessId: v.id("businesses"),
      customerId: v.id("customers"),
      productId: v.id("products"),
      productName: v.optional(v.string()), // snapshot
      productUnit: v.optional(v.string()), // snapshot
      quantity: v.number(),
      rate: v.number(), // rate at time of transaction in paise (reversals: negative quantity)
      totalAmount: v.number(), // quantity * rate in paise (signed; reversals negative)
      notes: v.optional(v.string()),
      date: v.string(), // YYYY-MM-DD (IST)
      recordedBy: v.id("users"),
      source: v.optional(v.union(v.literal("single"), v.literal("subscription"))),
      subscriptionId: v.optional(v.id("subscriptions")),
      reversalOfTransactionId: v.optional(v.id("transactions")),
    }).index("by_business_date", ["businessId", "date"])
      .index("by_customer", ["customerId"])
      .index("by_customer_date", ["customerId", "date"]),

    // Payment records (offline payments recorded in-app). Two-sided
    // verification: recorded -> pending -> confirmed/rejected. Confirmed
    // payments can only be corrected via `reversed` (audit kept on record).
    payments: defineTable({
      businessId: v.id("businesses"),
      customerId: v.id("customers"),
      amount: v.number(), // in paise
      method: v.string(), // "cash", "upi", "bank", "other"
      notes: v.optional(v.string()),
      date: v.string(), // YYYY-MM-DD (IST)
      recordedBy: v.id("users"),
      recordedByRole: v.union(v.literal("vendor"), v.literal("customer")),
      status: v.union(
        v.literal("pending"),
        v.literal("confirmed"),
        v.literal("rejected"),
      ),
      verifiedBy: v.optional(v.id("users")),
      verifiedAt: v.optional(v.number()),
      reversed: v.optional(v.boolean()),
      reversedAt: v.optional(v.number()),
      reversedBy: v.optional(v.id("users")),
      reversalNote: v.optional(v.string()),
    }).index("by_business_date", ["businessId", "date"])
      .index("by_customer", ["customerId"])
      .index("by_customer_date", ["customerId", "date"]),

    // Recurring purchase schedules
    subscriptions: defineTable({
      businessId: v.id("businesses"),
      customerId: v.id("customers"),
      productId: v.id("products"),
      quantity: v.number(),
      frequency: v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("monthly"),
      ),
      startDate: v.string(), // YYYY-MM-DD
      endDate: v.optional(v.string()), // YYYY-MM-DD; unset = ongoing
      status: v.union(v.literal("active"), v.literal("paused"), v.literal("ended")),
      lastGeneratedDate: v.optional(v.string()), // last date a purchase was generated
      createdBy: v.id("users"),
    }).index("by_business", ["businessId"])
      .index("by_customer", ["customerId"])
      .index("by_status", ["status"]),

    // Vendor-customer invite codes (shareable QR/link flow)
    connections: defineTable({
      businessId: v.id("businesses"),
      inviteCode: v.string(),
      customerUserId: v.optional(v.id("users")),
      customerId: v.optional(v.id("customers")), // set when inviting an offline customer
      status: v.union(v.literal("pending"), v.literal("connected")),
      createdByUserId: v.optional(v.id("users")),
    }).index("by_invite_code", ["inviteCode"])
      .index("by_business", ["businessId"]),

    // Two-sided connection requests by username
    connectionRequests: defineTable({
      businessId: v.id("businesses"),
      fromUserId: v.id("users"),
      toUserId: v.id("users"),
      // "vendor_to_customer": vendor sent it. "customer_to_vendor": customer sent it.
      direction: v.union(v.literal("vendor_to_customer"), v.literal("customer_to_vendor")),
      status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected")),
    }).index("by_to_user", ["toUserId"])
      .index("by_from_user", ["fromUserId"])
      .index("by_business", ["businessId"]),

    // Monthly statements/bills (snapshots; generated on the 1st for the prior month)
    monthlyBills: defineTable({
      businessId: v.id("businesses"),
      customerId: v.id("customers"),
      yearMonth: v.string(), // YYYY-MM
      openingBalance: v.number(), // outstanding carried in (can be negative = credit)
      totalBilled: v.number(),
      confirmedPayments: v.number(),
      closingBalance: v.number(),
      generatedAt: v.number(),
      emailSentAt: v.optional(v.number()),
    }).index("by_customer_month", ["customerId", "yearMonth"])
      .index("by_business_month", ["businessId", "yearMonth"]),

    // In-app notifications
    notifications: defineTable({
      userId: v.id("users"),
      type: v.string(),
      title: v.string(),
      body: v.optional(v.string()),
      read: v.optional(v.boolean()),
      relatedType: v.optional(v.string()), // e.g. "payment", "customer", "subscription", "bill"
      relatedId: v.optional(v.string()),
    }).index("by_user", ["userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
