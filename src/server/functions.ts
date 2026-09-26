// All business functions ported from the Convex backend to Postgres/Drizzle.
// Exposed as one RPC surface: fn(module.function) → handler(user, args).
// Logic mirrors src/convex/* 1:1 (validation, snapshots, notifications, auth).
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import {
  users,
  businesses,
  customers,
  products,
  transactions,
  payments,
  subscriptions,
  connections,
  connectionRequests,
  monthlyBills,
  notifications,
} from "../db/schema";
import {
  requireUser,
  getBusinessForUser,
  getCustomerForUser,
  customerTotals,
  statementForCustomer,
  istTodayString,
  istCurrentYearMonth,
  previousYearMonth,
  previousDay,
  lastDayOfMonth,
  safeMoney,
  notify,
  newId,
  randomCode,
  HttpError,
} from "./util";

type Handler = (ctx: { user: typeof users.$inferSelect | null }, args: any) => Promise<unknown>;

export const registry: Record<string, Handler> = {};

function fn(path: string, handler: Handler) {
  registry[path] = handler;
}

function requireAuth(ctx: { user: typeof users.$inferSelect | null }) {
  if (!ctx.user) throw new HttpError("Not authenticated", 401);
  return ctx.user;
}

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

function rupees(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function assertVendor(business: typeof businesses.$inferSelect, userId: string) {
  if (business.userId !== userId) throw new HttpError("Not authorized", 403);
}

function assertCustomerAccess(
  customer: typeof customers.$inferSelect,
  business: typeof businesses.$inferSelect | null,
  userId: string,
) {
  if (business && business.userId === userId) return;
  if (customer.linkedUserId === userId) return;
  throw new HttpError("Not authorized", 403);
}

// =============================================================== businesses

fn("businesses.create", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const existing = await getBusinessForUser(user.id);
  if (existing) return existing.id;

  let username: string | undefined;
  if (args?.username) {
    username = String(args.username).trim().toLowerCase();
    if (!USERNAME_RE.test(username)) {
      throw new HttpError("Use 3-24 lowercase letters, numbers, or underscores");
    }
    const takenU = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const takenB = await db.select().from(businesses).where(eq(businesses.username, username)).limit(1);
    if (takenU.length > 0 || takenB.length > 0) throw new HttpError("That username is taken");
  }

  const id = newId();
  await db.insert(businesses).values({ id, userId: user.id, name: args.name, phone: args.phone, username });
  await db.insert(products).values({
    id: newId(),
    businessId: id,
    name: "Item",
    unit: "Unit",
    price: 1000,
    active: true,
  });
  await db.update(users).set({ role: "vendor" }).where(eq(users.id, user.id));
  return id;
});

fn("businesses.getByUser", async (ctx) => {
  if (!ctx.user) return null;
  return await getBusinessForUser(ctx.user.id);
});

fn("businesses.update", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const business = await getBusinessForUser(user.id);
  if (!business) throw new HttpError("Business not found", 404);

  const patch: Partial<typeof businesses.$inferInsert> = {};
  if (args?.name !== undefined) {
    const name = String(args.name).trim();
    if (!name) throw new HttpError("Name cannot be empty");
    patch.name = name;
  }
  if (args?.phone !== undefined) patch.phone = String(args.phone).trim() || undefined;
  if (args?.username !== undefined) {
    if (business.username) throw new HttpError("Username already set");
    const username = String(args.username).trim().toLowerCase();
    if (!USERNAME_RE.test(username)) {
      throw new HttpError("Use 3-24 lowercase letters, numbers, or underscores");
    }
    const takenU = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const takenB = await db.select().from(businesses).where(eq(businesses.username, username)).limit(1);
    if (takenU.length > 0 || takenB.length > 0) throw new HttpError("That username is taken");
    patch.username = username;
  }
  if (Object.keys(patch).length > 0) await db.update(businesses).set(patch).where(eq(businesses.id, business.id));
  return (await db.select().from(businesses).where(eq(businesses.id, business.id)).limit(1))[0];
});

fn("businesses.searchByName", async (_ctx, args) => {
  const db = getDb();
  const q = String(args?.name ?? "").toLowerCase().trim();
  const all = await db.select().from(businesses);
  return all
    .filter((b) => b.name.toLowerCase().includes(q))
    .map((b) => ({ id: b.id, name: b.name }))
    .slice(0, 10);
});

// =============================================================== products

fn("products.getMine", async (ctx) => {
  const user = requireAuth(ctx);
  const business = await getBusinessForUser(user.id);
  if (!business) return [];
  const db = getDb();
  return db.select().from(products).where(eq(products.businessId, business.id));
});

fn("products.getByBusiness", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const business = (await db.select().from(businesses).where(eq(businesses.id, args.businessId)).limit(1))[0];
  if (!business) throw new HttpError("Business not found", 404);

  const isOwner = business.userId === user.id;
  if (!isOwner) {
    const customer = await getCustomerForUser(user.id);
    if (!customer || customer.businessId !== args.businessId) throw new HttpError("Not authorized", 403);
  }
  const rows = await db.select().from(products).where(eq(products.businessId, args.businessId));
  return isOwner ? rows : rows.filter((p) => p.active !== false);
});

fn("products.create", async (ctx, args) => {
  const user = requireAuth(ctx);
  const business = await getBusinessForUser(user.id);
  if (!business) throw new HttpError("Business not found", 404);
  const db = getDb();

  const name = String(args?.name ?? "").trim();
  const unit = String(args?.unit ?? "").trim();
  if (!name) throw new HttpError("Product name is required");
  if (!unit) throw new HttpError("Unit is required");
  const price = Number(args?.price);
  if (!(price > 0)) throw new HttpError("Price must be greater than zero");

  const id = newId();
  await db.insert(products).values({
    id,
    businessId: business.id,
    name,
    description: args?.description ? String(args.description).trim() : undefined,
    unit,
    price: safeMoney(price),
    active: true,
  });
  return id;
});

fn("products.update", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const product = (await db.select().from(products).where(eq(products.id, args.productId)).limit(1))[0];
  if (!product) throw new HttpError("Product not found", 404);
  const business = (await db.select().from(businesses).where(eq(businesses.id, product.businessId)).limit(1))[0];
  if (!business) throw new HttpError("Business not found", 404);
  assertVendor(business, user.id);

  const patch: Partial<typeof products.$inferInsert> = {};
  if (args?.name !== undefined) {
    const name = String(args.name).trim();
    if (!name) throw new HttpError("Product name is required");
    patch.name = name;
  }
  if (args?.description !== undefined) patch.description = String(args.description).trim() || undefined;
  if (args?.unit !== undefined) {
    const unit = String(args.unit).trim();
    if (!unit) throw new HttpError("Unit is required");
    patch.unit = unit;
  }
  if (args?.price !== undefined) {
    const price = Number(args.price);
    if (!(price > 0)) throw new HttpError("Price must be greater than zero");
    patch.price = safeMoney(price);
  }
  if (args?.active !== undefined) patch.active = !!args.active;
  if (Object.keys(patch).length > 0) await db.update(products).set(patch).where(eq(products.id, product.id));
  return (await db.select().from(products).where(eq(products.id, product.id)).limit(1))[0];
});

// =============================================================== customers

fn("customers.getByLinkedUser", async (ctx) => {
  if (!ctx.user) return null;
  const customer = await getCustomerForUser(ctx.user.id);
  if (!customer) return null;
  const totals = await customerTotals(customer.id);
  return { ...customer, ...totals };
});

fn("customers.getByBusiness", async (ctx) => {
  const user = requireAuth(ctx);
  const business = await getBusinessForUser(user.id);
  if (!business) return [];
  const db = getDb();
  const rows = await db.select().from(customers).where(eq(customers.businessId, business.id));
  return Promise.all(
    rows.map(async (c) => ({ ...c, ...(await customerTotals(c.id)) })),
  );
});

fn("customers.getOne", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const customer = (await db.select().from(customers).where(eq(customers.id, args.customerId)).limit(1))[0];
  if (!customer) return null;
  const business = (await db.select().from(businesses).where(eq(businesses.id, customer.businessId)).limit(1))[0];
  if (!business) return null;
  assertCustomerAccess(customer, business, user.id);

  const totals = await customerTotals(customer.id);
  const bills = await db.select().from(monthlyBills).where(eq(monthlyBills.customerId, customer.id));
  const recentBills = bills.sort((a, b) => (a.yearMonth < b.yearMonth ? 1 : -1)).slice(0, 6);
  return { ...customer, ...totals, recentBills };
});

fn("customers.getStatement", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const customer = (await db.select().from(customers).where(eq(customers.id, args.customerId)).limit(1))[0];
  if (!customer) return null;
  const business = (await db.select().from(businesses).where(eq(businesses.id, customer.businessId)).limit(1))[0];
  if (!business) return null;
  assertCustomerAccess(customer, business, user.id);

  const startDate = `${args.yearMonth}-01`;
  const endDate = lastDayOfMonth(args.yearMonth);
  const statement = await statementForCustomer(customer.id, startDate, endDate);

  const txs = await db.select().from(transactions).where(eq(transactions.customerId, customer.id));
  const pays = await db.select().from(payments).where(eq(payments.customerId, customer.id));
  const inRange = (d: string) => d >= startDate && d <= endDate;

  const pendingPayments = pays
    .filter((p) => inRange(p.date) && p.status === "pending" && !p.reversed)
    .reduce((s, p) => s + p.amount, 0);
  const rejectedPayments = pays
    .filter((p) => inRange(p.date) && p.status === "rejected" && !p.reversed)
    .reduce((s, p) => s + p.amount, 0);
  const monthTxs = txs.filter((t) => inRange(t.date));

  return {
    customer,
    business: { id: business.id, name: business.name },
    yearMonth: args.yearMonth,
    ...statement,
    pendingPayments,
    rejectedPayments,
    transactionCount: monthTxs.length,
  };
});

fn("customers.getMyVendor", async (ctx) => {
  if (!ctx.user) return null;
  const customer = await getCustomerForUser(ctx.user.id);
  if (!customer) return null;
  const db = getDb();
  const business = (await db.select().from(businesses).where(eq(businesses.id, customer.businessId)).limit(1))[0];
  if (!business) return null;
  return {
    businessId: business.id,
    name: business.name,
    phone: business.phone ?? null,
    active: customer.active !== false,
  };
});

fn("customers.create", async (ctx, args) => {
  const user = requireAuth(ctx);
  const business = await getBusinessForUser(user.id);
  if (!business) throw new HttpError("Set up your business first", 400);
  const db = getDb();
  const name = String(args?.name ?? "").trim();
  if (!name) throw new HttpError("Customer name is required");
  const id = newId();
  await db.insert(customers).values({
    id,
    businessId: business.id,
    name,
    phone: args?.phone ? String(args.phone).trim() : undefined,
    active: true,
  });
  return id;
});

fn("customers.update", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const customer = (await db.select().from(customers).where(eq(customers.id, args.customerId)).limit(1))[0];
  if (!customer) throw new HttpError("Customer not found", 404);
  const business = (await db.select().from(businesses).where(eq(businesses.id, customer.businessId)).limit(1))[0];
  if (!business || business.userId !== user.id) throw new HttpError("Not authorized", 403);

  const patch: Partial<typeof customers.$inferInsert> = {};
  if (args?.name !== undefined) {
    const name = String(args.name).trim();
    if (!name) throw new HttpError("Name cannot be empty");
    patch.name = name;
  }
  if (args?.phone !== undefined) patch.phone = String(args.phone).trim() || undefined;
  if (args?.active !== undefined) patch.active = !!args.active;
  if (Object.keys(patch).length > 0) await db.update(customers).set(patch).where(eq(customers.id, customer.id));
  return (await db.select().from(customers).where(eq(customers.id, customer.id)).limit(1))[0];
});

fn("customers.setActive", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const customer = (await db.select().from(customers).where(eq(customers.id, args.customerId)).limit(1))[0];
  if (!customer) throw new HttpError("Customer not found", 404);
  const business = (await db.select().from(businesses).where(eq(businesses.id, customer.businessId)).limit(1))[0];
  if (!business || business.userId !== user.id) throw new HttpError("Not authorized", 403);
  await db.update(customers).set({ active: !!args.active }).where(eq(customers.id, customer.id));
  return { ok: true };
});

// =============================================================== connections

fn("connections.getByBusiness", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const business = (await db.select().from(businesses).where(eq(businesses.id, args.businessId)).limit(1))[0];
  if (!business) throw new HttpError("Business not found", 404);
  assertVendor(business, user.id);

  const rows = await db.select().from(connections).where(eq(connections.businessId, business.id));
  return Promise.all(
    rows.map(async (conn) => {
      const customer = conn.customerId
        ? (await db.select().from(customers).where(eq(customers.id, conn.customerId)).limit(1))[0] ?? null
        : null;
      const linkedUser = conn.customerUserId
        ? (await db.select().from(users).where(eq(users.id, conn.customerUserId)).limit(1))[0] ?? null
        : null;
      return {
        ...conn,
        customerName: customer?.name ?? linkedUser?.name ?? null,
        username: linkedUser?.username ?? null,
      };
    }),
  );
});

fn("connections.getMyInvite", async (ctx) => {
  if (!ctx.user) return null;
  const business = await getBusinessForUser(ctx.user.id);
  if (!business) return null;
  const db = getDb();
  const rows = await db.select().from(connections).where(eq(connections.businessId, business.id));
  return rows.find((conn) => conn.status === "pending" && !conn.customerUserId) ?? null;
});

fn("connections.createInvite", async (ctx, args) => {
  const user = requireAuth(ctx);
  const business = await getBusinessForUser(user.id);
  if (!business) throw new HttpError("Business not found", 404);
  const db = getDb();

  if (args?.customerId) {
    const customer = (await db.select().from(customers).where(eq(customers.id, args.customerId)).limit(1))[0];
    if (!customer || customer.businessId !== business.id) throw new HttpError("Customer not found", 404);
    const rows = await db.select().from(connections).where(eq(connections.businessId, business.id));
    const existing = rows.find((conn) => conn.status === "pending" && conn.customerId === args.customerId);
    if (existing) return existing;
  }

  const id = newId();
  await db.insert(connections).values({
    id,
    businessId: business.id,
    inviteCode: randomCode("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6),
    customerId: args?.customerId,
    status: "pending",
    createdByUserId: user.id,
  });
  return (await db.select().from(connections).where(eq(connections.id, id)).limit(1))[0];
});

fn("connections.sendVendorRequest", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const business = await getBusinessForUser(user.id);
  if (!business) throw new HttpError("Set up your business first", 400);

  const username = String(args?.username ?? "").trim().toLowerCase();
  if (!USERNAME_RE.test(username)) throw new HttpError("Invalid username");

  const target = (await db.select().from(users).where(eq(users.username, username)).limit(1))[0];
  if (!target) throw new HttpError(`No account with username "${username}"`, 404);
  if (target.id === user.id) throw new HttpError("You can't connect to yourself");
  if (business.username && target.username === business.username) {
    throw new HttpError("You can't connect to yourself");
  }

  const existingReqs = await db
    .select()
    .from(connectionRequests)
    .where(eq(connectionRequests.businessId, business.id));
  if (
    existingReqs.some(
      (r) => r.toUserId === target.id && r.status === "pending" && r.direction === "vendor_to_customer",
    )
  ) {
    throw new HttpError("Request already pending", 409);
  }

  const alreadyCustomer = await getCustomerForUser(target.id);
  if (alreadyCustomer && alreadyCustomer.businessId === business.id) {
    throw new HttpError("Already connected", 409);
  }

  await db.insert(connectionRequests).values({
    id: newId(),
    businessId: business.id,
    fromUserId: user.id,
    toUserId: target.id,
    direction: "vendor_to_customer",
    status: "pending",
  });

  await notify({
    userId: target.id,
    type: "connection_request",
    title: `${business.name} wants to connect`,
    body: "Open notifications to accept or reject this request.",
    relatedType: "connection",
  });
  return { ok: true };
});

fn("connections.sendCustomerRequest", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const customer = await getCustomerForUser(user.id);
  if (customer) throw new HttpError("You're already connected to a business", 409);

  let business: typeof businesses.$inferSelect | undefined;
  if (args?.businessId) {
    business = (await db.select().from(businesses).where(eq(businesses.id, args.businessId)).limit(1))[0];
  } else if (args?.username) {
    const username = String(args.username).trim().toLowerCase();
    if (!USERNAME_RE.test(username)) throw new HttpError("Invalid username");
    business = (await db.select().from(businesses).where(eq(businesses.username, username)).limit(1))[0];
  }
  if (!business) throw new HttpError("No business found for that username", 404);

  const dup = await db
    .select()
    .from(connectionRequests)
    .where(eq(connectionRequests.businessId, business.id));
  if (
    dup.some(
      (r) => r.toUserId === user.id && r.status === "pending" && r.direction === "customer_to_vendor",
    )
  ) {
    throw new HttpError("Request already pending", 409);
  }

  await db.insert(connectionRequests).values({
    id: newId(),
    businessId: business.id,
    fromUserId: user.id,
    toUserId: business.userId,
    direction: "customer_to_vendor",
    status: "pending",
  });

  await notify({
    userId: business.userId,
    type: "connection_request",
    title: "New customer connection request",
    body: "Open notifications to accept or reject this request.",
    relatedType: "connection",
  });
  return business.name;
});

fn("connections.getMyRequests", async (ctx) => {
  if (!ctx.user) return [];
  const db = getDb();
  const requests = await db
    .select()
    .from(connectionRequests)
    .where(eq(connectionRequests.toUserId, ctx.user.id));
  const pending = requests.filter((r) => r.status === "pending");

  return Promise.all(
    pending.map(async (r) => {
      const business = (await db.select().from(businesses).where(eq(businesses.id, r.businessId)).limit(1))[0];
      const fromUser = (await db.select().from(users).where(eq(users.id, r.fromUserId)).limit(1))[0];
      return {
        id: r.id,
        direction: r.direction,
        businessName: business?.name ?? "Unknown business",
        fromName: fromUser?.name ?? "Someone",
      };
    }),
  );
});

fn("connections.respondToRequest", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const request = (await db.select().from(connectionRequests).where(eq(connectionRequests.id, args.requestId)).limit(1))[0];
  if (!request) throw new HttpError("Request not found", 404);
  if (request.toUserId !== user.id) throw new HttpError("Not authorized", 403);
  if (request.status !== "pending") throw new HttpError("Request already handled", 409);

  const business = (await db.select().from(businesses).where(eq(businesses.id, request.businessId)).limit(1))[0];
  if (!business) throw new HttpError("Business no longer exists", 404);

  if (!args.accept) {
    await db.update(connectionRequests).set({ status: "rejected" }).where(eq(connectionRequests.id, request.id));
    await notify({
      userId: request.fromUserId,
      type: "connection_rejected",
      title: "Connection request declined",
      relatedType: "connection",
    });
    return { accepted: false };
  }

  await db.update(connectionRequests).set({ status: "accepted" }).where(eq(connectionRequests.id, request.id));

  if (request.direction === "vendor_to_customer") {
    const customer = await getCustomerForUser(user.id);
    if (customer && customer.businessId === business.id) {
      // already linked
    } else if (customer) {
      throw new HttpError("You're already connected to another business", 409);
    } else {
      await db.insert(customers).values({
        id: newId(),
        businessId: business.id,
        name: user.name ?? "Customer",
        phone: user.phone ?? undefined,
        linkedUserId: user.id,
        active: true,
      });
      await db.update(users).set({ role: "customer" }).where(eq(users.id, user.id));
    }
  } else {
    const fromUser = (await db.select().from(users).where(eq(users.id, request.fromUserId)).limit(1))[0];
    const existing = await getCustomerForUser(request.fromUserId);
    if (!existing) {
      await db.insert(customers).values({
        id: newId(),
        businessId: business.id,
        name: fromUser?.name ?? "Customer",
        phone: fromUser?.phone ?? undefined,
        linkedUserId: request.fromUserId,
        active: true,
      });
    }
    await db.update(users).set({ role: "customer" }).where(eq(users.id, request.fromUserId));
    await notify({
      userId: request.fromUserId,
      type: "connection_accepted",
      title: `${business.name} accepted your request`,
      body: "You can now see their products and your ledger.",
      relatedType: "connection",
    });
  }

  return { accepted: true };
});

fn("connections.getByCode", async (_ctx, args) => {
  const code = String(args?.inviteCode ?? "").trim().toUpperCase();
  if (!code) return null;
  const db = getDb();
  const conn = (await db.select().from(connections).where(eq(connections.inviteCode, code)).limit(1))[0];
  if (!conn) return null;
  const business = (await db.select().from(businesses).where(eq(businesses.id, conn.businessId)).limit(1))[0];
  return {
    businessName: business?.name ?? "a business",
    status: conn.status,
    alreadyLinkedUserId: conn.customerUserId ?? null,
  };
});

fn("connections.connectCustomer", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const code = String(args?.inviteCode ?? "").trim().toUpperCase();
  const conn = (await db.select().from(connections).where(eq(connections.inviteCode, code)).limit(1))[0];
  if (!conn) throw new HttpError("Invalid invite code", 404);
  const business = (await db.select().from(businesses).where(eq(businesses.id, conn.businessId)).limit(1))[0];
  if (!business) throw new HttpError("Business no longer exists", 404);

  if (conn.customerUserId === user.id) {
    const customer = await getCustomerForUser(user.id);
    if (customer) return customer;
  }
  if (conn.status === "connected" && conn.customerUserId) {
    throw new HttpError("This invite has already been used", 409);
  }

  const existingForBusiness = await getCustomerForUser(user.id);
  if (existingForBusiness && existingForBusiness.businessId === conn.businessId) {
    return existingForBusiness;
  }
  if (existingForBusiness) throw new HttpError("You're already connected to another business", 409);

  let customerId: string;
  if (conn.customerId) {
    const offline = (await db.select().from(customers).where(eq(customers.id, conn.customerId)).limit(1))[0];
    if (offline && offline.businessId === conn.businessId && !offline.linkedUserId) {
      await db
        .update(customers)
        .set({ linkedUserId: user.id, phone: offline.phone ?? user.phone, active: true })
        .where(eq(customers.id, offline.id));
      customerId = offline.id;
    } else {
      customerId = newId();
      await db.insert(customers).values({
        id: customerId,
        businessId: conn.businessId,
        name: user.name ?? "Customer",
        phone: user.phone ?? undefined,
        linkedUserId: user.id,
        active: true,
      });
    }
  } else {
    customerId = newId();
    await db.insert(customers).values({
      id: customerId,
      businessId: conn.businessId,
      name: user.name ?? "Customer",
      phone: user.phone ?? undefined,
      linkedUserId: user.id,
      active: true,
    });
  }

  await db
    .update(connections)
    .set({ customerUserId: user.id, status: "connected" })
    .where(eq(connections.id, conn.id));
  await db.update(users).set({ role: "customer" }).where(eq(users.id, user.id));

  await notify({
    userId: business.userId,
    type: "connection_accepted",
    title: `${user.name ?? "A customer"} connected`,
    body: `They used your invite code ${code}.`,
    relatedType: "customer",
    relatedId: customerId,
  });

  return (await db.select().from(customers).where(eq(customers.id, customerId)).limit(1))[0];
});

// =============================================================== transactions

fn("transactions.create", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const business = await getBusinessForUser(user.id);
  if (!business) throw new HttpError("Business not found", 404);

  const customer = (await db.select().from(customers).where(eq(customers.id, args.customerId)).limit(1))[0];
  if (!customer || customer.businessId !== business.id) {
    throw new HttpError("Customer not found in your business", 404);
  }
  const product = (await db.select().from(products).where(eq(products.id, args.productId)).limit(1))[0];
  if (!product || product.businessId !== business.id) {
    throw new HttpError("Product not found in your business", 404);
  }
  if (product.active === false) {
    throw new HttpError("This product is disabled — enable it to record purchases");
  }
  const quantity = Number(args?.quantity);
  if (!(quantity > 0)) throw new HttpError("Quantity must be greater than zero");

  const date = args?.date ?? istTodayString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError("Invalid date");

  const rate = product.price;
  const totalAmount = safeMoney(quantity * rate);

  const id = newId();
  await db.insert(transactions).values({
    id,
    businessId: business.id,
    customerId: args.customerId,
    productId: args.productId,
    productName: product.name,
    productUnit: product.unit,
    quantity,
    rate,
    totalAmount,
    notes: args?.notes ? String(args.notes).trim() : undefined,
    date,
    recordedBy: user.id,
    source: "single",
  });

  if (customer.linkedUserId) {
    await notify({
      userId: customer.linkedUserId,
      type: "purchase",
      title: `New purchase: ${product.name}`,
      body: `${quantity} ${product.unit} · ${rupees(totalAmount)}`,
      relatedType: "customer",
      relatedId: args.customerId,
    });
  }
  return id;
});

fn("transactions.getByCustomer", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const customer = (await db.select().from(customers).where(eq(customers.id, args.customerId)).limit(1))[0];
  if (!customer) throw new HttpError("Customer not found", 404);
  const business = (await db.select().from(businesses).where(eq(businesses.id, customer.businessId)).limit(1))[0];
  if (!business) throw new HttpError("Business not found", 404);
  assertCustomerAccess(customer, business, user.id);

  let txs = await db.select().from(transactions).where(eq(transactions.customerId, args.customerId));
  if (args?.startDate) txs = txs.filter((t) => t.date >= args.startDate);
  if (args?.endDate) txs = txs.filter((t) => t.date <= args.endDate);
  if (args?.productId) txs = txs.filter((t) => t.productId === args.productId);
  if (args?.source) txs = txs.filter((t) => t.source === args.source);
  return txs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
});

fn("transactions.getMine", async (ctx, args) => {
  const user = requireAuth(ctx);
  const customer = await getCustomerForUser(user.id);
  if (!customer) return [];
  const db = getDb();
  let txs = await db.select().from(transactions).where(eq(transactions.customerId, customer.id));
  if (args?.startDate) txs = txs.filter((t) => t.date >= args.startDate);
  if (args?.endDate) txs = txs.filter((t) => t.date <= args.endDate);
  if (args?.productId) txs = txs.filter((t) => t.productId === args.productId);
  if (args?.source) txs = txs.filter((t) => t.source === args.source);
  return txs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
});

fn("transactions.getMyBusiness", async (ctx, args) => {
  const user = requireAuth(ctx);
  const business = await getBusinessForUser(user.id);
  if (!business) return [];
  const db = getDb();
  let txs = await db.select().from(transactions).where(eq(transactions.businessId, business.id));
  if (args?.startDate) txs = txs.filter((t) => t.date >= args.startDate);
  if (args?.endDate) txs = txs.filter((t) => t.date <= args.endDate);
  return txs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
});

fn("transactions.reverse", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const original = (await db.select().from(transactions).where(eq(transactions.id, args.transactionId)).limit(1))[0];
  if (!original) throw new HttpError("Transaction not found", 404);
  const business = (await db.select().from(businesses).where(eq(businesses.id, original.businessId)).limit(1))[0];
  if (!business) throw new HttpError("Business not found", 404);
  if (business.userId !== user.id) {
    throw new HttpError("Only the business owner can reverse a purchase", 403);
  }

  const existing = await db.select().from(transactions).where(eq(transactions.customerId, original.customerId));
  if (existing.some((t) => t.reversalOfTransactionId === original.id)) {
    throw new HttpError("This purchase is already reversed", 409);
  }

  const id = newId();
  await db.insert(transactions).values({
    id,
    businessId: original.businessId,
    customerId: original.customerId,
    productId: original.productId,
    productName: original.productName ?? "Reversal",
    productUnit: original.productUnit,
    quantity: -original.quantity,
    rate: original.rate,
    totalAmount: -original.totalAmount,
    notes: args?.reason ? String(args.reason).trim() : "Reversal of recorded purchase",
    date: istTodayString(),
    recordedBy: user.id,
    source: original.source,
    subscriptionId: original.subscriptionId,
    reversalOfTransactionId: original.id,
  });

  const customer = (await db.select().from(customers).where(eq(customers.id, original.customerId)).limit(1))[0];
  if (customer?.linkedUserId) {
    await notify({
      userId: customer.linkedUserId,
      type: "transaction_reversed",
      title: `Purchase reversed: ${original.productName ?? "item"}`,
      body: `−${rupees(original.totalAmount)} removed from your account`,
      relatedType: "customer",
      relatedId: original.customerId,
    });
  }
  return id;
});

// =============================================================== payments

const METHODS = ["cash", "upi", "bank", "other"];

fn("payments.create", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const amount = Number(args?.amount);
  if (!(amount > 0)) throw new HttpError("Amount must be greater than zero");
  if (!METHODS.includes(String(args?.method))) throw new HttpError("Invalid payment method");

  const date = args?.date ?? istTodayString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError("Invalid date");

  const customer = (await db.select().from(customers).where(eq(customers.id, args.customerId)).limit(1))[0];
  if (!customer) throw new HttpError("Customer not found", 404);
  const business = (await db.select().from(businesses).where(eq(businesses.id, customer.businessId)).limit(1))[0];
  if (!business) throw new HttpError("Business not found", 404);

  const isVendor = business.userId === user.id;
  const isCustomer = customer.linkedUserId === user.id;
  if (!isVendor && !isCustomer) throw new HttpError("Not authorized", 403);
  if (isCustomer && customer.active === false) throw new HttpError("This account is inactive", 403);

  const recent = await db
    .select()
    .from(payments)
    .where(and(eq(payments.customerId, args.customerId), eq(payments.date, date)));
  if (
    recent.some(
      (p) =>
        p.amount === safeMoney(amount) &&
        p.method === args.method &&
        Date.now() - new Date(p.createdAt).getTime() < 60_000,
    )
  ) {
    throw new HttpError("This payment was just recorded — check history before retrying", 409);
  }

  const id = newId();
  await db.insert(payments).values({
    id,
    businessId: customer.businessId,
    customerId: args.customerId,
    amount: safeMoney(amount),
    method: String(args.method),
    notes: args?.notes ? String(args.notes).trim() : undefined,
    date,
    recordedBy: user.id,
    recordedByRole: isVendor ? "vendor" : "customer",
    status: "pending",
  });

  if (isVendor && customer.linkedUserId) {
    await notify({
      userId: customer.linkedUserId,
      type: "payment_verify_request",
      title: `Verify payment: ${rupees(amount)}`,
      body: `${business.name} recorded a ${args.method} payment. Confirm or dispute it.`,
      relatedType: "payment",
      relatedId: id,
    });
  } else if (isCustomer) {
    await notify({
      userId: business.userId,
      type: "payment_verify_request",
      title: `Verify payment: ${rupees(amount)}`,
      body: `${customer.name} recorded a ${args.method} payment. Confirm or dispute it.`,
      relatedType: "payment",
      relatedId: id,
    });
  }
  return id;
});

fn("payments.verify", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const payment = (await db.select().from(payments).where(eq(payments.id, args.paymentId)).limit(1))[0];
  if (!payment) throw new HttpError("Payment not found", 404);
  if (payment.status !== "pending") throw new HttpError("Only pending payments can be verified", 409);

  const customer = (await db.select().from(customers).where(eq(customers.id, payment.customerId)).limit(1))[0];
  if (!customer) throw new HttpError("Customer not found", 404);
  const business = (await db.select().from(businesses).where(eq(businesses.id, payment.businessId)).limit(1))[0];
  if (!business) throw new HttpError("Business not found", 404);

  const isVendor = business.userId === user.id;
  const isCustomer = customer.linkedUserId === user.id;
  if (!isVendor && !isCustomer) throw new HttpError("Not authorized", 403);
  if (payment.recordedBy === user.id) {
    throw new HttpError("The person who recorded a payment can't verify it", 403);
  }

  await db
    .update(payments)
    .set({
      status: args.decision,
      verifiedBy: user.id,
      verifiedAt: Date.now(),
    })
    .where(eq(payments.id, payment.id));

  const whoVerified = isVendor ? business.name : customer.name;
  if (args.decision === "confirmed") {
    await notify({
      userId: payment.recordedBy,
      type: "payment_confirmed",
      title: `Payment confirmed: ${rupees(payment.amount)}`,
      body: `Verified by ${whoVerified}`,
      relatedType: "payment",
      relatedId: payment.id,
    });
  } else {
    await notify({
      userId: payment.recordedBy,
      type: "payment_rejected",
      title: `Payment disputed: ${rupees(payment.amount)}`,
      body: args?.note ? String(args.note).trim() : `${whoVerified} disputed this payment. Balance is unaffected until resolved.`,
      relatedType: "payment",
      relatedId: payment.id,
    });
    const otherId = isVendor ? customer.linkedUserId : business.userId;
    if (otherId && otherId !== payment.recordedBy) {
      await notify({
        userId: otherId,
        type: "payment_rejected",
        title: `Payment disputed: ${rupees(payment.amount)}`,
        body: args?.note ? String(args.note).trim() : "A recorded payment was disputed.",
        relatedType: "payment",
        relatedId: payment.id,
      });
    }
  }
  return { status: args.decision };
});

fn("payments.reverse", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const payment = (await db.select().from(payments).where(eq(payments.id, args.paymentId)).limit(1))[0];
  if (!payment) throw new HttpError("Payment not found", 404);
  if (payment.status !== "confirmed") throw new HttpError("Only confirmed payments can be reversed", 409);
  if (payment.reversed) throw new HttpError("Payment already reversed", 409);

  const customer = (await db.select().from(customers).where(eq(customers.id, payment.customerId)).limit(1))[0];
  if (!customer) throw new HttpError("Customer not found", 404);
  const business = (await db.select().from(businesses).where(eq(businesses.id, payment.businessId)).limit(1))[0];
  if (!business) throw new HttpError("Business not found", 404);

  const isVendor = business.userId === user.id;
  const isCustomer = customer.linkedUserId === user.id;
  if (!isVendor && !isCustomer) throw new HttpError("Not authorized", 403);

  await db
    .update(payments)
    .set({
      reversed: true,
      reversedAt: Date.now(),
      reversedBy: user.id,
      reversalNote: args?.note ? String(args.note).trim() : "Reversed",
    })
    .where(eq(payments.id, payment.id));

  const note = args?.note ? String(args.note).trim() : "No reason given";
  await notify({
    userId: payment.recordedBy,
    type: "payment_reversed",
    title: `Payment reversed: ${rupees(payment.amount)}`,
    body: note,
    relatedType: "payment",
    relatedId: payment.id,
  });
  const otherId = isVendor ? customer.linkedUserId : business.userId;
  if (otherId && otherId !== payment.recordedBy) {
    await notify({
      userId: otherId,
      type: "payment_reversed",
      title: `Payment reversed: ${rupees(payment.amount)}`,
      body: note,
      relatedType: "payment",
      relatedId: payment.id,
    });
  }
  return { reversed: true };
});

fn("payments.getByCustomer", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const customer = (await db.select().from(customers).where(eq(customers.id, args.customerId)).limit(1))[0];
  if (!customer) throw new HttpError("Customer not found", 404);
  const business = (await db.select().from(businesses).where(eq(businesses.id, customer.businessId)).limit(1))[0];
  if (!business) throw new HttpError("Business not found", 404);
  assertCustomerAccess(customer, business, user.id);

  let rows = await db.select().from(payments).where(eq(payments.customerId, args.customerId));
  if (args?.startDate) rows = rows.filter((p) => p.date >= args.startDate);
  if (args?.endDate) rows = rows.filter((p) => p.date <= args.endDate);
  if (args?.status) rows = rows.filter((p) => p.status === args.status);
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
});

fn("payments.getPendingForMe", async (ctx) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const business = await getBusinessForUser(user.id);
  const customer = await getCustomerForUser(user.id);

  const out: Array<{
    id: string;
    amount: number;
    method: string;
    date: string;
    status: string;
    recordedByRole: string;
    customerId: string;      customerName?: string | null;
      businessName?: string | null;
      notes?: string | null;
  }> = [];

  if (business) {
    const rows = await db.select().from(payments).where(eq(payments.businessId, business.id));
    for (const p of rows.filter((p) => p.status === "pending" && p.recordedBy !== user.id)) {
      const c = (await db.select().from(customers).where(eq(customers.id, p.customerId)).limit(1))[0];
      out.push({
        id: p.id,
        amount: p.amount,
        method: p.method,
        date: p.date,
        status: p.status,
        recordedByRole: p.recordedByRole,
        customerId: p.customerId,
        customerName: c?.name ?? undefined,
        notes: p.notes,
      });
    }
  } else if (customer) {
    const rows = await db.select().from(payments).where(eq(payments.customerId, customer.id));
    const biz = (await db.select().from(businesses).where(eq(businesses.id, customer.businessId)).limit(1))[0];
    for (const p of rows.filter((p) => p.status === "pending" && p.recordedBy !== user.id)) {
      out.push({
        id: p.id,
        amount: p.amount,
        method: p.method,
        date: p.date,
        status: p.status,
        recordedByRole: p.recordedByRole,
        customerId: p.customerId,
        businessName: biz?.name ?? undefined,
        notes: p.notes,
      });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
});

// =============================================================== subscriptions

function addStep(dateStr: string, freq: "daily" | "weekly" | "monthly"): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (freq === "daily") {
    const dt = new Date(Date.UTC(y, m - 1, d + 1));
    return dt.toISOString().split("T")[0];
  }
  if (freq === "weekly") {
    const dt = new Date(Date.UTC(y, m - 1, d + 7));
    return dt.toISOString().split("T")[0];
  }
  const target = new Date(Date.UTC(y, m - 1 + 1, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().split("T")[0];
}

fn("subscriptions.create", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const business = await getBusinessForUser(user.id);
  if (!business) throw new HttpError("Business not found", 404);

  const customer = (await db.select().from(customers).where(eq(customers.id, args.customerId)).limit(1))[0];
  if (!customer || customer.businessId !== business.id) {
    throw new HttpError("Customer not found in your business", 404);
  }
  const product = (await db.select().from(products).where(eq(products.id, args.productId)).limit(1))[0];
  if (!product || product.businessId !== business.id) {
    throw new HttpError("Product not found in your business", 404);
  }
  if (product.active === false) {
    throw new HttpError("Disabled products can't be used for new subscriptions");
  }
  const quantity = Number(args?.quantity);
  if (!(quantity > 0)) throw new HttpError("Quantity must be greater than zero");

  const startDate = args?.startDate ?? istTodayString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new HttpError("Invalid start date");

  const id = newId();
  await db.insert(subscriptions).values({
    id,
    businessId: business.id,
    customerId: args.customerId,
    productId: args.productId,
    quantity,
    frequency: args.frequency,
    startDate,
    status: "active",
    createdBy: user.id,
  });

  if (customer.linkedUserId) {
    await notify({
      userId: customer.linkedUserId,
      type: "subscription_started",
      title: `Subscription started: ${product.name}`,
      body: `${quantity} ${product.unit} ${args.frequency} from ${startDate}`,
      relatedType: "subscription",
      relatedId: id,
    });
  }
  return id;
});

fn("subscriptions.getMyBusiness", async (ctx, args) => {
  const user = requireAuth(ctx);
  const business = await getBusinessForUser(user.id);
  if (!business) return [];
  const db = getDb();
  let rows = await db.select().from(subscriptions).where(eq(subscriptions.businessId, business.id));
  if (args?.status) rows = rows.filter((s) => s.status === args.status);

  return Promise.all(
    rows.map(async (s) => {
      const customer = (await db.select().from(customers).where(eq(customers.id, s.customerId)).limit(1))[0];
      const product = (await db.select().from(products).where(eq(products.id, s.productId)).limit(1))[0];
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
});

fn("subscriptions.getMine", async (ctx) => {
  const user = requireAuth(ctx);
  const customer = await getCustomerForUser(user.id);
  if (!customer) return [];
  const db = getDb();
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.customerId, customer.id));
  return Promise.all(
    rows.map(async (s) => {
      const product = (await db.select().from(products).where(eq(products.id, s.productId)).limit(1))[0];
      return {
        ...s,
        productName: product?.name ?? "Unknown",
        productUnit: product?.unit ?? "",
        productPrice: product?.price ?? 0,
      };
    }),
  );
});

fn("subscriptions.update", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const business = await getBusinessForUser(user.id);
  if (!business) throw new HttpError("Business not found", 404);
  const sub = (await db.select().from(subscriptions).where(eq(subscriptions.id, args.subscriptionId)).limit(1))[0];
  if (!sub || sub.businessId !== business.id) throw new HttpError("Subscription not found", 404);

  const patch: Partial<typeof subscriptions.$inferInsert> = {};
  if (args?.quantity !== undefined) {
    const q = Number(args.quantity);
    if (!(q > 0)) throw new HttpError("Quantity must be greater than zero");
    patch.quantity = q;
  }
  if (args?.frequency !== undefined) patch.frequency = args.frequency;
  if (args?.productId !== undefined) {
    const product = (await db.select().from(products).where(eq(products.id, args.productId)).limit(1))[0];
    if (!product || product.businessId !== business.id) {
      throw new HttpError("Product not found in your business", 404);
    }
    if (product.active === false) {
      throw new HttpError("Disabled products can't be used for subscriptions");
    }
    patch.productId = args.productId;
  }
  if (Object.keys(patch).length > 0) {
    await db.update(subscriptions).set(patch).where(eq(subscriptions.id, sub.id));
  }
  return (await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id)).limit(1))[0];
});

fn("subscriptions.pause", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const business = await getBusinessForUser(user.id);
  if (!business) throw new HttpError("Business not found", 404);
  const sub = (await db.select().from(subscriptions).where(eq(subscriptions.id, args.subscriptionId)).limit(1))[0];
  if (!sub || sub.businessId !== business.id) throw new HttpError("Subscription not found", 404);
  if (sub.status !== "active") throw new HttpError("Only active subscriptions can be paused", 409);

  await db.update(subscriptions).set({ status: "paused" }).where(eq(subscriptions.id, sub.id));
  const product = (await db.select().from(products).where(eq(products.id, sub.productId)).limit(1))[0];
  const customer = (await db.select().from(customers).where(eq(customers.id, sub.customerId)).limit(1))[0];
  if (customer?.linkedUserId) {
    await notify({
      userId: customer.linkedUserId,
      type: "subscription_paused",
      title: `Subscription paused: ${product?.name ?? "item"}`,
      relatedType: "subscription",
      relatedId: sub.id,
    });
  }
  return { ok: true };
});

fn("subscriptions.resume", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const business = await getBusinessForUser(user.id);
  if (!business) throw new HttpError("Business not found", 404);
  const sub = (await db.select().from(subscriptions).where(eq(subscriptions.id, args.subscriptionId)).limit(1))[0];
  if (!sub || sub.businessId !== business.id) throw new HttpError("Subscription not found", 404);
  if (sub.status !== "paused") throw new HttpError("Only paused subscriptions can be resumed", 409);

  await db.update(subscriptions).set({ status: "active" }).where(eq(subscriptions.id, sub.id));
  const product = (await db.select().from(products).where(eq(products.id, sub.productId)).limit(1))[0];
  const customer = (await db.select().from(customers).where(eq(customers.id, sub.customerId)).limit(1))[0];
  if (customer?.linkedUserId) {
    await notify({
      userId: customer.linkedUserId,
      type: "subscription_resumed",
      title: `Subscription resumed: ${product?.name ?? "item"}`,
      relatedType: "subscription",
      relatedId: sub.id,
    });
  }
  return { ok: true };
});

fn("subscriptions.end", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const business = await getBusinessForUser(user.id);
  if (!business) throw new HttpError("Business not found", 404);
  const sub = (await db.select().from(subscriptions).where(eq(subscriptions.id, args.subscriptionId)).limit(1))[0];
  if (!sub || sub.businessId !== business.id) throw new HttpError("Subscription not found", 404);
  if (sub.status === "ended") return { ok: true };

  await db.update(subscriptions).set({ status: "ended" }).where(eq(subscriptions.id, sub.id));
  const product = (await db.select().from(products).where(eq(products.id, sub.productId)).limit(1))[0];
  const customer = (await db.select().from(customers).where(eq(customers.id, sub.customerId)).limit(1))[0];
  if (customer?.linkedUserId) {
    await notify({
      userId: customer.linkedUserId,
      type: "subscription_ended",
      title: `Subscription ended: ${product?.name ?? "item"}`,
      body: "Past purchases remain on your account.",
      relatedType: "subscription",
      relatedId: sub.id,
    });
  }
  return { ok: true };
});

// Internal: generate today's subscription purchases (idempotent via lastGeneratedDate).
export async function generateForToday(): Promise<number> {
  const db = getDb();
  const today = istTodayString();
  let created = 0;

  const active = await db.select().from(subscriptions).where(eq(subscriptions.status, "active"));
  for (const sub of active) {
    if (sub.startDate > today) continue;
    if (sub.endDate && sub.endDate < today) {
      await db.update(subscriptions).set({ status: "ended" }).where(eq(subscriptions.id, sub.id));
      continue;
    }
    if (sub.lastGeneratedDate && sub.lastGeneratedDate >= today) continue;

    const anchor = sub.lastGeneratedDate ?? null;
    let due = false;
    if (!anchor) {
      due = sub.startDate <= today;
    } else {
      let cursor = anchor;
      let guard = 0;
      while (cursor < today && guard < 400) {
        cursor = addStep(cursor, sub.frequency as "daily" | "weekly" | "monthly");
        guard++;
        if (cursor === today) {
          due = true;
          break;
        }
      }
      if (!due && guard >= 400) due = true;
    }
    if (!due) continue;

    const product = (await db.select().from(products).where(eq(products.id, sub.productId)).limit(1))[0];
    if (!product || product.active === false) continue;

    const rate = product.price;
    const totalAmount = Math.round(sub.quantity * rate);

    await db.insert(transactions).values({
      id: newId(),
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
      subscriptionId: sub.id,
    });
    await db.update(subscriptions).set({ lastGeneratedDate: today }).where(eq(subscriptions.id, sub.id));
    created++;
  }
  return created;
}

// Internal: expire subscriptions past endDate.
export async function expireSubscriptions(): Promise<number> {
  const db = getDb();
  const today = istTodayString();
  const active = await db.select().from(subscriptions).where(eq(subscriptions.status, "active"));
  let expired = 0;
  for (const sub of active) {
    if (sub.endDate && sub.endDate < today) {
      await db.update(subscriptions).set({ status: "ended" }).where(eq(subscriptions.id, sub.id));
      expired++;
    }
  }
  return expired;
}

// Internal: monthly statements for the prior month (idempotent).
export async function generateMonthlyBills(): Promise<number> {
  const db = getDb();
  const yearMonth = previousYearMonth(istTodayString());
  const startDate = `${yearMonth}-01`;
  const endDate = lastDayOfMonth(yearMonth);
  let generated = 0;

  const allCustomers = await db.select().from(customers);
  for (const customer of allCustomers) {
    const existing = await db
      .select()
      .from(monthlyBills)
      .where(and(eq(monthlyBills.customerId, customer.id), eq(monthlyBills.yearMonth, yearMonth)))
      .limit(1);
    if (existing.length > 0) continue;

    const opening = (await customerTotals(customer.id, { untilDate: previousDay(startDate) })).due;
    const statement = await statementForCustomer(customer.id, startDate, endDate);
    if (statement.totalBilled === 0 && statement.confirmedPayments === 0 && opening === 0) continue;

    const closingBalance = opening + statement.totalBilled - statement.confirmedPayments;
    await db.insert(monthlyBills).values({
      id: newId(),
      businessId: customer.businessId,
      customerId: customer.id,
      yearMonth,
      openingBalance: opening,
      totalBilled: statement.totalBilled,
      confirmedPayments: statement.confirmedPayments,
      closingBalance,
      generatedAt: Date.now(),
    });
    generated++;

    if (customer.linkedUserId) {
      await notify({
        userId: customer.linkedUserId,
        type: "bill_generated",
        title: `Monthly statement ready: ${yearMonth}`,
        body: `${rupees(closingBalance)} balance after this month`,
        relatedType: "bill",
        relatedId: `${customer.id}:${yearMonth}`,
      });
    }
  }
  return generated;
}

// Internal: payment reminders every 3 days (1st, 4th, 7th...).
export async function sendPaymentReminders(): Promise<number> {
  const db = getDb();
  const today = istTodayString();
  const day = Number(today.slice(8, 10));
  if (day % 3 !== 1) return 0;

  let sent = 0;
  const allCustomers = await db.select().from(customers);
  for (const customer of allCustomers) {
    const totals = await customerTotals(customer.id);
    if (totals.due > 0 && customer.linkedUserId) {
      await notify({
        userId: customer.linkedUserId,
        type: "payment_reminder",
        title: `Outstanding balance: ${rupees(totals.due)}`,
        body: "Open your dashboard to review and record a payment.",
        relatedType: "customer",
        relatedId: customer.id,
      });
      sent++;
    }
  }

  const allBusinesses = await db.select().from(businesses);
  for (const business of allBusinesses) {
    const rows = await db.select().from(payments).where(eq(payments.businessId, business.id));
    const pending = rows.filter((p) => p.status === "pending" && !p.reversed);
    if (pending.length > 0) {
      await notify({
        userId: business.userId,
        type: "verification_reminder",
        title: `${pending.length} payment${pending.length === 1 ? "" : "s"} need verification`,
        body: "Confirm or dispute recorded payments to keep balances accurate.",
      });
      sent++;
    }
  }
  return sent;
}

// =============================================================== dashboard

fn("dashboard.vendorOverview", async (ctx) => {
  const user = requireAuth(ctx);
  const business = await getBusinessForUser(user.id);
  if (!business) return null;
  const db = getDb();

  const todayStr = istTodayString();
  const monthStart = istCurrentYearMonth() + "-01";

  const customersAll = await db.select().from(customers).where(eq(customers.businessId, business.id));
  const activeCustomers = customersAll.filter((c) => c.active !== false);

  let totalOutstanding = 0;
  let totalBilledMonth = 0;
  let monthTxCount = 0;
  const overdueCustomers: Array<{ name: string; due: number }> = [];

  const monthTransactions = await db
    .select()
    .from(transactions)
    .where(eq(transactions.businessId, business.id));

  for (const c of activeCustomers) {
    const totals = await customerTotals(c.id);
    if (totals.due > 0) {
      totalOutstanding += totals.due;
      overdueCustomers.push({ name: c.name, due: totals.due });
    }
  }

  const monthTx = monthTransactions.filter((t) => t.date >= monthStart);
  for (const t of monthTx) {
    if (t.totalAmount > 0) totalBilledMonth += t.totalAmount;
    monthTxCount++;
  }

  const todayTx = monthTx.filter((t) => t.date === todayStr && t.totalAmount > 0);
  const todayAmount = todayTx.reduce((s, t) => s + t.totalAmount, 0);

  const monthPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.businessId, business.id));
  const confirmedMonth = monthPayments
    .filter((p) => p.status === "confirmed" && !p.reversed && p.date >= monthStart)
    .reduce((s, p) => s + p.amount, 0);
  const pendingVerify = monthPayments.filter(
    (p) => p.status === "pending" && !p.reversed && p.recordedBy !== user.id,
  ).length;

  const subs = await db.select().from(subscriptions).where(eq(subscriptions.businessId, business.id));
  const activeSubs = subs.filter((s) => s.status === "active").length;

  const recentTx = [...monthTransactions]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1))
    .slice(0, 5);
  const recent = await Promise.all(
    recentTx.map(async (t) => {
      const customer = (await db.select().from(customers).where(eq(customers.id, t.customerId)).limit(1))[0];
      return {
        id: t.id,
        date: t.date,
        productName: t.productName ?? "",
        productUnit: t.productUnit ?? "",
        quantity: t.quantity,
        totalAmount: t.totalAmount,
        customerName: customer?.name ?? "",
      };
    }),
  );

  return {
    businessName: business.name,
    totalCustomers: activeCustomers.length,
    activeSubscriptions: activeSubs,
    todayPurchases: todayAmount,
    todayCount: todayTx.length,
    monthBilled: totalBilledMonth,
    paymentsReceivedMonth: confirmedMonth,
    totalOutstanding,
    pendingVerifications: pendingVerify,
    overdueCustomers: overdueCustomers.sort((a, b) => b.due - a.due).slice(0, 5),
    recentActivity: recent,
  };
});

fn("dashboard.customerOverview", async (ctx) => {
  const user = requireAuth(ctx);
  const customer = await getCustomerForUser(user.id);
  if (!customer) return null;
  const db = getDb();

  const business = (await db.select().from(businesses).where(eq(businesses.id, customer.businessId)).limit(1))[0];
  const totals = await customerTotals(customer.id);
  const monthStart = istCurrentYearMonth() + "-01";

  const monthTx = (await db.select().from(transactions).where(eq(transactions.customerId, customer.id))).filter(
    (t) => t.date >= monthStart,
  );
  const monthBilled = monthTx.filter((t) => t.totalAmount > 0).reduce((s, t) => s + t.totalAmount, 0);

  const monthPay = (await db.select().from(payments).where(eq(payments.customerId, customer.id))).filter(
    (p) => p.date >= monthStart,
  );
  const monthPaid = monthPay
    .filter((p) => p.status === "confirmed" && !p.reversed)
    .reduce((s, p) => s + p.amount, 0);
  const pendingVerify = monthPay.filter((p) => p.status === "pending" && p.recordedBy !== user.id).length;

  const subs = await db.select().from(subscriptions).where(eq(subscriptions.customerId, customer.id));
  const activeSubs = subs.filter((s) => s.status === "active");

  const recentTx = [...monthTx]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1))
    .slice(0, 5);

  return {
    customerName: customer.name,
    businessName: business?.name ?? "",
    outstanding: totals.due,
    credit: Math.max(0, -totals.due),
    monthBilled,
    monthPaid,
    pendingVerifications: pendingVerify,
    activeSubscriptions: activeSubs.length,
    recentActivity: recentTx.map((t) => ({
      id: t.id,
      date: t.date,
      productName: t.productName ?? "",
      productUnit: t.productUnit ?? "",
      quantity: t.quantity,
      totalAmount: t.totalAmount,
    })),
  };
});

fn("dashboard.unreadCount", async (ctx) => {
  if (!ctx.user) return 0;
  const db = getDb();
  const rows = await db.select().from(notifications).where(eq(notifications.userId, ctx.user.id));
  return rows.filter((n) => !n.read).length;
});

// =============================================================== summary

fn("summary.customerMonthlySummary", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const customer = (await db.select().from(customers).where(eq(customers.id, args.customerId)).limit(1))[0];
  if (!customer) return null;
  const business = (await db.select().from(businesses).where(eq(businesses.id, customer.businessId)).limit(1))[0];
  if (!business) return null;
  assertCustomerAccess(customer, business, user.id);

  const startDate = `${args.yearMonth}-01`;
  const endDate = lastDayOfMonth(args.yearMonth);

  const allTxs = await db.select().from(transactions).where(eq(transactions.customerId, args.customerId));
  const allPays = await db.select().from(payments).where(eq(payments.customerId, args.customerId));
  const txs = allTxs.filter((t) => t.date >= startDate && t.date <= endDate);
  const pays = allPays.filter((p) => p.date >= startDate && p.date <= endDate);

  const productMap = new Map<string, { quantity: number; amount: number; unit: string }>();
  for (const t of txs) {
    if (t.totalAmount <= 0) continue;
    const key = t.productName ?? "Unknown";
    const existing = productMap.get(key) ?? { quantity: 0, amount: 0, unit: t.productUnit ?? "" };
    productMap.set(key, {
      quantity: existing.quantity + t.quantity,
      amount: existing.amount + t.totalAmount,
      unit: existing.unit || (t.productUnit ?? ""),
    });
  }
  const productSummary = Array.from(productMap.entries()).map(([name, data]) => ({
    name,
    quantity: data.quantity,
    unit: data.unit,
    amount: data.amount,
  }));

  const confirmedPayments = pays
    .filter((p) => p.status === "confirmed" && !p.reversed)
    .reduce((s, p) => s + p.amount, 0);
  const pendingPayments = pays
    .filter((p) => p.status === "pending" && !p.reversed)
    .reduce((s, p) => s + p.amount, 0);
  const totalBilled = txs.reduce((s, t) => s + t.totalAmount, 0);

  return {
    totalBilled,
    confirmedPayments,
    pendingPayments,
    due: totalBilled - confirmedPayments,
    products: productSummary,
    transactions: txs,
    payments: pays,
  };
});

fn("summary.businessForCustomer", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const customer = (await db.select().from(customers).where(eq(customers.id, args.customerId)).limit(1))[0];
  if (!customer) return null;
  const business = (await db.select().from(businesses).where(eq(businesses.id, customer.businessId)).limit(1))[0];
  if (!business) return null;
  assertCustomerAccess(customer, business, user.id);
  return business;
});

// =============================================================== notifications

fn("notifications.list", async (ctx) => {
  if (!ctx.user) return [];
  const db = getDb();
  const rows = await db.select().from(notifications).where(eq(notifications.userId, ctx.user.id));
  return rows.sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, 60);
});

fn("notifications.markRead", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const n = (await db.select().from(notifications).where(eq(notifications.id, args.notificationId)).limit(1))[0];
  if (!n || n.userId !== user.id) throw new HttpError("Not authorized", 403);
  await db.update(notifications).set({ read: true }).where(eq(notifications.id, n.id));
  return { ok: true };
});

fn("notifications.markAllRead", async (ctx) => {
  const user = requireAuth(ctx);
  const db = getDb();
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, user.id));
  return { ok: true };
});

// users module (profile updates live in auth routes, but expose claimUsername here too)
fn("users.updateProfile", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const patch: { name?: string; phone?: string } = {};
  if (args?.name !== undefined) {
    const name = String(args.name).trim();
    if (!name) throw new HttpError("Name cannot be empty");
    patch.name = name;
  }
  if (args?.phone !== undefined) patch.phone = String(args.phone).trim() || undefined;
  if (Object.keys(patch).length > 0) await db.update(users).set(patch).where(eq(users.id, user.id));
  return (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0];
});

fn("users.claimUsername", async (ctx, args) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const username = String(args?.username ?? "").trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    throw new HttpError("Use 3-24 lowercase letters, numbers, or underscores");
  }
  if (user.username) throw new HttpError("You already have a username");
  const takenU = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const takenB = await db.select().from(businesses).where(eq(businesses.username, username)).limit(1);
  if (takenU.length > 0 || takenB.length > 0) throw new HttpError("That username is taken");
  await db.update(users).set({ username }).where(eq(users.id, user.id));
  return username;
});

fn("users.searchByUsername", async (_ctx, args) => {
  const q = String(args?.query ?? "").trim().toLowerCase();
  if (q.length < 2) return { users: [], businesses: [] };
  const db = getDb();
  const userRows = await db.select().from(users).where(eq(users.username, q)).limit(5);
  const bizRows = await db.select().from(businesses).where(eq(businesses.username, q)).limit(5);
  return {
    users: userRows.map((u) => ({ userId: u.id, name: u.name ?? "Unnamed", username: u.username ?? "" })),
    businesses: bizRows.map((b) => ({ businessId: b.id, name: b.name, username: b.username ?? "" })),
  };
});

fn("users.currentUser", async (ctx) => {
  return ctx.user;
});
