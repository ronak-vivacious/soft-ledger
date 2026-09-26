import {
  pgTable,
  text,
  boolean,
  integer,
  bigint,
  doublePrecision,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const created = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

// ------------------------------------------------------------------ auth

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    email: text("email").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    role: text("role"), // "vendor" | "customer"
    phone: text("phone"),
    username: text("username"),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    uniqueIndex("users_username_uq").on(t.username),
  ],
);

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    code: text("code").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: created(),
  },
  (t) => [index("otp_email_idx").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex("sessions_token_uq").on(t.tokenHash)],
);

// ------------------------------------------------------------------ core

export const businesses = pgTable(
  "businesses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    username: text("username"),
    createdAt: created(),
  },
  (t) => [
    index("businesses_user_idx").on(t.userId),
    uniqueIndex("businesses_username_uq").on(t.username),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    linkedUserId: text("linked_user_id"),
    active: boolean("active").default(true),
    createdAt: created(),
  },
  (t) => [
    index("customers_business_idx").on(t.businessId),
    index("customers_linked_user_idx").on(t.linkedUserId),
  ],
);

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    unit: text("unit").notNull(),
    price: bigint("price", { mode: "number" }).notNull(), // paise
    active: boolean("active").default(true),
    createdAt: created(),
  },
  (t) => [index("products_business_idx").on(t.businessId)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    customerId: text("customer_id").notNull(),
    productId: text("product_id").notNull(),
    productName: text("product_name"),
    productUnit: text("product_unit"),
    quantity: doublePrecision("quantity").notNull(),
    rate: bigint("rate", { mode: "number" }).notNull(),
    totalAmount: bigint("total_amount", { mode: "number" }).notNull(),
    notes: text("notes"),
    date: text("date").notNull(), // YYYY-MM-DD (IST)
    recordedBy: text("recorded_by").notNull(),
    source: text("source"), // "single" | "subscription"
    subscriptionId: text("subscription_id"),
    reversalOfTransactionId: text("reversal_of_transaction_id"),
    createdAt: created(),
  },
  (t) => [
    index("tx_business_date_idx").on(t.businessId, t.date),
    index("tx_customer_date_idx").on(t.customerId, t.date),
    index("tx_customer_idx").on(t.customerId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    customerId: text("customer_id").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(), // paise
    method: text("method").notNull(),
    notes: text("notes"),
    date: text("date").notNull(), // YYYY-MM-DD (IST)
    recordedBy: text("recorded_by").notNull(),
    recordedByRole: text("recorded_by_role").notNull(),
    status: text("status").notNull().default("pending"),
    verifiedBy: text("verified_by"),
    verifiedAt: bigint("verified_at", { mode: "number" }),
    reversed: boolean("reversed").default(false),
    reversedAt: bigint("reversed_at", { mode: "number" }),
    reversedBy: text("reversed_by"),
    reversalNote: text("reversal_note"),
    createdAt: created(),
  },
  (t) => [
    index("payments_business_date_idx").on(t.businessId, t.date),
    index("payments_customer_date_idx").on(t.customerId, t.date),
    index("payments_customer_idx").on(t.customerId),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    customerId: text("customer_id").notNull(),
    productId: text("product_id").notNull(),
    quantity: doublePrecision("quantity").notNull(),
    frequency: text("frequency").notNull(), // daily | weekly | monthly
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    status: text("status").notNull().default("active"),
    lastGeneratedDate: text("last_generated_date"),
    createdBy: text("created_by").notNull(),
    createdAt: created(),
  },
  (t) => [
    index("subs_business_idx").on(t.businessId),
    index("subs_customer_idx").on(t.customerId),
    index("subs_status_idx").on(t.status),
  ],
);

export const connections = pgTable(
  "connections",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    inviteCode: text("invite_code").notNull(),
    customerUserId: text("customer_user_id"),
    customerId: text("customer_id"),
    status: text("status").notNull().default("pending"),
    createdByUserId: text("created_by_user_id"),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("connections_code_uq").on(t.inviteCode),
    index("connections_business_idx").on(t.businessId),
  ],
);

export const connectionRequests = pgTable(
  "connection_requests",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    fromUserId: text("from_user_id").notNull(),
    toUserId: text("to_user_id").notNull(),
    direction: text("direction").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: created(),
  },
  (t) => [
    index("connreq_to_user_idx").on(t.toUserId),
    index("connreq_business_idx").on(t.businessId),
  ],
);

export const monthlyBills = pgTable(
  "monthly_bills",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    customerId: text("customer_id").notNull(),
    yearMonth: text("year_month").notNull(),
    openingBalance: bigint("opening_balance", { mode: "number" }).notNull(),
    totalBilled: bigint("total_billed", { mode: "number" }).notNull(),
    confirmedPayments: bigint("confirmed_payments", { mode: "number" }).notNull(),
    closingBalance: bigint("closing_balance", { mode: "number" }).notNull(),
    generatedAt: bigint("generated_at", { mode: "number" }).notNull(),
    emailSentAt: bigint("email_sent_at", { mode: "number" }),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("bills_customer_month_uq").on(t.customerId, t.yearMonth),
    index("bills_business_month_idx").on(t.businessId, t.yearMonth),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    read: boolean("read").default(false),
    relatedType: text("related_type"),
    relatedId: text("related_id"),
    createdAt: created(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);
