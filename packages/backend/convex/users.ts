import { v } from "convex/values";
import { componentsGeneric, makeFunctionReference } from "convex/server";
import type { ComponentApi } from "@convex-dev/better-auth/_generated/component.js";
import { effectiveAccess, initialAccess } from "domain/core";
import { query, mutation, internalMutation, env } from "./_generated/server";
import { z } from "zod";
import { lookupUser, registerUser } from "./access";
import { creationPermission } from "./communityGovernance";

export const statusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("disabled"),
);
const accessValidator = v.object({
  status: statusValidator,
  editorial: v.boolean(),
  canCreateCommunity: v.optional(v.boolean()),
  communityLimit: v.optional(v.number()),
});
export const bootstrap = mutation({
  args: {},
  returns: accessValidator,
  handler: async (ctx) => {
    const user = await registerUser(ctx);
    return {
      status: effectiveAccess(user.status),
      editorial: user.editorial === true,
    };
  },
});
export const access = query({
  args: {},
  returns: v.union(accessValidator, v.null()),
  handler: async (ctx) => {
    const user = await lookupUser(ctx);
    return user
      ? {
          status: effectiveAccess(user.status),
          editorial: user.editorial === true,
          canCreateCommunity: (await creationPermission(ctx, user)).canCreate,
          communityLimit: user.communityCreationLimit ?? 1,
        }
      : null;
  },
});
// Run once during rollout; safe to repeat. Does not activate pending/disabled users.
export const backfill = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("users")
      .paginate({ cursor: args.cursor, numItems: 100 });
    for (const user of page.page)
      await ctx.db.patch(user._id, {
        normalizedEmail: user.email.trim().toLowerCase(),
        normalizedName: user.name.trim().toLowerCase(),
        status: effectiveAccess(user.status),
      });
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation">("users:backfill"),
        { cursor: page.continueCursor },
      );
    return null;
  },
});
const authPageSchema = z.object({
  page: z.array(
    z.object({
      _id: z.string(),
      name: z.string(),
      email: z.string(),
      createdAt: z.number(),
    }),
  ),
  isDone: z.boolean(),
  continueCursor: z.string(),
});
export const importAuthUsers = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cutoff = Date.parse(env.PILOT_EXISTING_USERS_BEFORE ?? "");
    if (!Number.isFinite(cutoff))
      throw new Error(
        "Configure PILOT_EXISTING_USERS_BEFORE com o instante ISO UTC de ativação.",
      );
    const components = componentsGeneric() as unknown as {
      betterAuth: ComponentApi;
    };
    const result: unknown = await ctx.runQuery(
      components.betterAuth.adapter.findMany,
      { model: "user", paginationOpts: { cursor: args.cursor, numItems: 50 } },
    );
    const page = authPageSchema.parse(result);
    const settings = await ctx.db
      .query("accessSettings")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    for (const authUser of page.page) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
        .unique();
      const email = authUser.email.trim().toLowerCase();
      const reserved = await ctx.db
        .query("users")
        .withIndex("by_normalizedEmail", (q) => q.eq("normalizedEmail", email))
        .unique();
      if (!existing && !reserved)
        await ctx.db.insert("users", {
          authId: authUser._id,
          email,
          normalizedEmail: email,
          name: authUser.name,
          normalizedName: authUser.name.toLowerCase(),
          status: initialAccess(
            settings?.approvalRequired ?? true,
            authUser.createdAt < cutoff,
          ),
          editorial: false,
        });
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation">("users:importAuthUsers"),
        { cursor: page.continueCursor },
      );
    return null;
  },
});
