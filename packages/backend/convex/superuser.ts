import { ConvexError, v } from "convex/values";
import { defaultThemes, effectiveAccess, themesInputSchema, userDeletionBlockers } from "domain/core";
import { query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./server";
import type { Doc, Id } from "./_generated/dataModel";
import { findUser } from "./access";
import { statusValidator } from "./users";

async function requireSystem(ctx: QueryCtx) {
  const user = await findUser(ctx);
  if (user.superuser !== true) throw new ConvexError("Acesso exclusivo de superusuários.");
  return user;
}

function present(user: Doc<"users">) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    status: effectiveAccess(user.status),
    editorial: user.editorial === true,
    superuser: user.superuser === true,
    linked: !!user.authId,
  };
}

const directoryUser = v.object({
  id: v.id("users"),
  name: v.string(),
  email: v.string(),
  status: statusValidator,
  editorial: v.boolean(),
  superuser: v.boolean(),
  linked: v.boolean(),
});

export const listUsers = query({
  args: {},
  returns: v.array(directoryUser),
  handler: async (ctx) => {
    await requireSystem(ctx);
    const rows = await ctx.db.query("users").take(200);
    const rank = { pending: 0, approved: 1, disabled: 2 };
    return rows
      .map(present)
      .sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name, "pt"));
  },
});

async function assertCanChange(ctx: MutationCtx, actor: Id<"users">, target: Doc<"users">, next: "approved" | "disabled") {
  if (target._id === actor) throw new ConvexError("Você não pode alterar a própria conta nesta tela.");
  if (target.superuser === true) throw new ConvexError("Superusuários só podem ser alterados pelo painel do responsável.");
  if (next === "approved") return;
  if (await ctx.db.query("communities").withIndex("by_ownerId", (q) => q.eq("ownerId", target._id)).first())
    throw new ConvexError("Transfira a posse das comunidades antes de desativar.");
  const membership = await ctx.db.query("communityMembers").withIndex("by_user", (q) => q.eq("userId", target._id)).take(40);
  if (membership.some((member) => member.role !== "member"))
    throw new ConvexError("Remova a administração nas comunidades antes de desativar.");
}

export const setStatus = mutation({
  args: { id: v.id("users"), status: v.union(v.literal("approved"), v.literal("disabled")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireSystem(ctx);
    const current = await ctx.db.get(args.id);
    if (!current) throw new ConvexError("Cadastro não encontrado.");
    await assertCanChange(ctx, actor._id, current, args.status);
    await ctx.db.patch(args.id, { status: args.status });
    await ctx.db.insert("userAdminEvents", {
      actor: `superuser:${actor._id}`,
      target: args.id,
      action: `status:${effectiveAccess(current.status)}->${args.status}`,
      at: Date.now(),
    });
    return null;
  },
});

function takeAll<T>(rows: T[]) {
  if (rows.length >= 80) throw new ConvexError("Há dados demais para excluir com segurança. Desative a conta.");
  return rows;
}

export const deleteUser = mutation({
  args: { id: v.id("users"), confirmEmail: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireSystem(ctx);
    const current = await ctx.db.get(args.id);
    if (!current) throw new ConvexError("Cadastro não encontrado.");
    const ownsCommunity = !!(await ctx.db.query("communities").withIndex("by_ownerId", (q) => q.eq("ownerId", current._id)).first());
    const membership = await ctx.db.query("communityMembers").withIndex("by_user", (q) => q.eq("userId", current._id)).take(40);
    const messages = await ctx.db.query("communityMessages").withIndex("by_senderId", (q) => q.eq("senderId", current._id)).take(1);
    const shares = await ctx.db.query("scriptureShares").withIndex("by_senderId_and_requestId", (q) => q.eq("senderId", current._id)).take(1);
    const blocker = userDeletionBlockers({
      self: current._id === actor._id,
      superuser: current.superuser === true,
      editorial: current.editorial === true,
      ownsCommunity,
      communityManager: membership.some((member) => member.role !== "member"),
      hasCommunityMessages: messages.length > 0,
      hasScriptureShares: shares.length > 0,
      seedProfile: false,
      emailMatches: args.confirmEmail.trim().toLowerCase() === (current.normalizedEmail ?? current.email.trim().toLowerCase()),
    });
    if (blocker) throw new ConvexError(blocker);
    const id = current._id;
    for (const row of await takeAll(await ctx.db.query("communityJoinRequests").withIndex("by_userId", (q) => q.eq("userId", id)).take(80))) await ctx.db.delete(row._id);
    for (const row of await takeAll(membership)) await ctx.db.delete(row._id);
    for (const row of await takeAll(await ctx.db.query("notifications").withIndex("by_userId", (q) => q.eq("userId", id)).take(80))) await ctx.db.delete(row._id);
    for (const row of await takeAll(await ctx.db.query("friendCodes").withIndex("by_userId", (q) => q.eq("userId", id)).take(80))) await ctx.db.delete(row._id);
    for (const row of await takeAll(await ctx.db.query("friendships").withIndex("by_low_and_high", (q) => q.eq("low", id)).take(80))) await ctx.db.delete(row._id);
    for (const row of await takeAll(await ctx.db.query("friendships").withIndex("by_high", (q) => q.eq("high", id)).take(80))) await ctx.db.delete(row._id);
    for (const row of await takeAll(await ctx.db.query("shareMarkers").withIndex("by_ownerId_version_book_chapter_first_direction", (q) => q.eq("ownerId", id)).take(80))) await ctx.db.delete(row._id);
    for (const row of await takeAll(await ctx.db.query("shareViews").withIndex("by_ownerId", (q) => q.eq("ownerId", id)).take(80))) await ctx.db.delete(row._id);
    for (const row of await takeAll(await ctx.db.query("devotionalFavorites").withIndex("by_userId", (q) => q.eq("userId", id)).take(80))) await ctx.db.delete(row._id);
    for (const row of await takeAll(await ctx.db.query("favoriteRestoreReceipts").withIndex("by_userId", (q) => q.eq("userId", id)).take(80))) await ctx.db.delete(row._id);
    for (const row of await takeAll(await ctx.db.query("checklistTicks").withIndex("by_userId", (q) => q.eq("userId", id)).take(80))) await ctx.db.delete(row._id);
    await ctx.db.insert("userAdminEvents", { actor: `superuser:${actor._id}`, target: id, action: "delete", at: Date.now() });
    await ctx.db.delete(id);
    return null;
  },
});

const themesValidator = v.object({
  monthlyVerse: v.string(),
  monthlyReference: v.string(),
  weeklyVerse: v.string(),
  weeklyReference: v.string(),
});

export const getThemes = query({
  args: {},
  returns: themesValidator,
  handler: async (ctx) => {
    await requireSystem(ctx);
    const current = await ctx.db.query("globalSettings").withIndex("by_key", (q) => q.eq("key", "main")).unique();
    return current
      ? { monthlyVerse: current.monthlyVerse, monthlyReference: current.monthlyReference, weeklyVerse: current.weeklyVerse, weeklyReference: current.weeklyReference }
      : defaultThemes;
  },
});

export const setThemes = mutation({
  args: themesValidator,
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireSystem(ctx);
    const input = themesInputSchema.parse(args);
    const current = await ctx.db.query("globalSettings").withIndex("by_key", (q) => q.eq("key", "main")).unique();
    if (current) await ctx.db.patch(current._id, input);
    else await ctx.db.insert("globalSettings", { key: "main", ...input });
    await ctx.db.insert("userAdminEvents", { actor: `superuser:${actor._id}`, target: "themes", action: "themes", at: Date.now() });
    return null;
  },
});
