import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getBusinessForUser, assertVendor } from "./lib/helpers";

const money = (n: number) => Math.round(n);

/** All products for my business (vendor view — includes disabled). */
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const business = await getBusinessForUser(ctx, userId);
    if (!business) return [];

    return await ctx.db
      .query("products")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
  },
});

/** Public-ish: active products of a business, for connected customers. */
export const getByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const business = await ctx.db.get(args.businessId);
    if (!business) throw new Error("Business not found");

    const isOwner = business.userId === userId;
    if (!isOwner) {
      // Must be a connected customer of this business.
      const customer = await ctx.db
        .query("customers")
        .withIndex("by_linked_user", (q) => q.eq("linkedUserId", userId))
        .first();
      if (!customer || customer.businessId !== args.businessId) {
        throw new Error("Not authorized");
      }
    }

    const products = await ctx.db
      .query("products")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    return isOwner ? products : products.filter((p) => p.active !== false);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    unit: v.string(),
    price: v.number(), // paise
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const business = await getBusinessForUser(ctx, userId);
    if (!business) throw new Error("Business not found");

    const name = args.name.trim();
    const unit = args.unit.trim();
    if (!name) throw new Error("Product name is required");
    if (!unit) throw new Error("Unit is required");
    if (!(args.price > 0)) throw new Error("Price must be greater than zero");

    return await ctx.db.insert("products", {
      businessId: business._id,
      name,
      description: args.description?.trim() || undefined,
      unit,
      price: money(args.price),
      active: true,
    });
  },
});

export const update = mutation({
  args: {
    productId: v.id("products"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    unit: v.optional(v.string()),
    price: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");
    const business = await ctx.db.get(product.businessId);
    if (!business) throw new Error("Business not found");
    assertVendor(ctx, business, userId);

    const patch: {
      name?: string;
      description?: string;
      unit?: string;
      price?: number;
      active?: boolean;
    } = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Product name is required");
      patch.name = name;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.unit !== undefined) {
      const unit = args.unit.trim();
      if (!unit) throw new Error("Unit is required");
      patch.unit = unit;
    }
    if (args.price !== undefined) {
      if (!(args.price > 0)) throw new Error("Price must be greater than zero");
      patch.price = money(args.price);
    }
    if (args.active !== undefined) patch.active = args.active;

    if (Object.keys(patch).length > 0) await ctx.db.patch(args.productId, patch);
    return await ctx.db.get(args.productId);
  },
});
