import { ConvexError, v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { canCreateCommunity, canChangeRole, canManage, hasApprovedAccess, inviteSchema, joinDecisionSchema, memberRoleSchema } from "domain/core";
import { query, mutation, internalMutation } from "./_generated/server";
import type { QueryCtx, MutationCtx, Id } from "./server";
import type { Doc } from "./_generated/dataModel";
import { findUser, membership } from "./access";
import { creationValidator, requestPageValidator } from "./communityValidators";

export async function creationPermission(ctx: QueryCtx, user: Doc<"users">) {
  const groups = await ctx.db.query("communities").withIndex("by_ownerId", q => q.eq("ownerId", user._id)).take(21);
  const value = { allowed: user.communityCreationAllowed === true, limit: user.communityCreationLimit ?? 1, owned: groups.length };
  return { ...value, canCreate: hasApprovedAccess(user.status) && canCreateCommunity(value) };
}
export const creation = query({ args: {}, returns: creationValidator, handler: async ctx => creationPermission(ctx, await findUser(ctx)) });

export async function requestJoin(ctx: MutationCtx, rawCode: string) {
  const user = await findUser(ctx), code = inviteSchema.parse(rawCode);
  const c = await ctx.db.query("communities").withIndex("by_invite", q => q.eq("inviteCode", code)).unique();
  if (!c) throw new ConvexError("Não encontramos uma comunidade com esse código.");
  const member = await ctx.db.query("communityMembers").withIndex("by_pair", q => q.eq("communityId", c._id).eq("userId", user._id)).unique();
  if (member) return c._id;
  const previous = await ctx.db.query("communityJoinRequests").withIndex("by_communityId_and_userId", q => q.eq("communityId", c._id).eq("userId", user._id)).unique();
  if (previous?.state === "pending") return c._id;
  const value = { communityId: c._id, userId: user._id, state: "pending" as const, requestedAt: Date.now() };
  if (previous) await ctx.db.replace(previous._id, value);
  else await ctx.db.insert("communityJoinRequests", value);
  return c._id;
}
async function presentRequest(ctx: QueryCtx, r: Doc<"communityJoinRequests">) {
  return { id: r._id, communityId: r.communityId, communityName: (await ctx.db.get(r.communityId))?.name ?? "Comunidade indisponível", userId: r.userId, name: (await ctx.db.get(r.userId))?.name ?? "Leitor", state: r.state, requestedAt: r.requestedAt };
}
export const myJoinRequests = query({
  args: { cursor: v.union(v.string(), v.null()) }, returns: requestPageValidator,
  handler: async (ctx, args) => {
    const user = await findUser(ctx);
    const page = await ctx.db.query("communityJoinRequests").withIndex("by_userId", q => q.eq("userId", user._id)).order("desc").paginate({ cursor: args.cursor, numItems: 30 });
    return { items: await Promise.all(page.page.map(r => presentRequest(ctx, r))), cursor: page.isDone ? null : page.continueCursor };
  },
});
export const joinRequests = query({
  args: { id: v.id("communities"), cursor: v.union(v.string(), v.null()) }, returns: requestPageValidator,
  handler: async (ctx, args) => {
    await membership(ctx, args.id, true);
    const page = await ctx.db.query("communityJoinRequests").withIndex("by_communityId_and_state", q => q.eq("communityId", args.id).eq("state", "pending")).paginate({ cursor: args.cursor, numItems: 30 });
    return { items: await Promise.all(page.page.map(r => presentRequest(ctx, r))), cursor: page.isDone ? null : page.continueCursor };
  },
});
export const cancelJoinRequest = mutation({
  args: { requestId: v.id("communityJoinRequests") }, returns: v.null(),
  handler: async (ctx, args) => {
    const user = await findUser(ctx), request = await ctx.db.get(args.requestId);
    if (!request || request.userId !== user._id) throw new ConvexError("Pedido não encontrado.");
    if (request.state === "pending") await ctx.db.patch(request._id, { state: "cancelled", decidedAt: Date.now() });
    return null;
  },
});
export const decideJoinRequest = mutation({
  args: { requestId: v.id("communityJoinRequests"), decision: v.union(v.literal("approve"), v.literal("reject")) }, returns: v.null(),
  handler: async (ctx, args) => {
    joinDecisionSchema.parse(args.decision);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("Pedido não encontrado.");
    const { user } = await membership(ctx, request.communityId, true);
    if (request.state !== "pending") return null;
    const applicant = await ctx.db.get(request.userId);
    if (args.decision === "approve") {
      if (!applicant || !hasApprovedAccess(applicant.status)) throw new ConvexError("O solicitante precisa ter acesso aprovado.");
      const existing = await ctx.db.query("communityMembers").withIndex("by_pair", q => q.eq("communityId", request.communityId).eq("userId", request.userId)).unique();
      if (!existing) await ctx.db.insert("communityMembers", { communityId: request.communityId, userId: request.userId, role: "member" });
    }
    await ctx.db.patch(request._id, { state: args.decision === "approve" ? "approved" : "rejected", decidedAt: Date.now(), decidedBy: user._id });
    return null;
  },
});
export async function activeManagerCount(ctx: QueryCtx, id: Id<"communities">) {
  let count = 0;
  for await (const member of ctx.db.query("communityMembers").withIndex("by_community", q => q.eq("communityId", id))) {
    if (!canManage(member.role)) continue;
    const account = await ctx.db.get(member.userId);
    if (account && hasApprovedAccess(account.status)) count++;
  }
  return count;
}
export const setMemberRole = mutation({
  args: { id: v.id("communities"), memberId: v.id("communityMembers"), role: v.union(v.literal("admin"), v.literal("member")) }, returns: v.null(),
  handler: async (ctx, args) => {
    memberRoleSchema.parse(args);
    const { member } = await membership(ctx, args.id, true), target = await ctx.db.get(args.memberId);
    if (!target || target.communityId !== args.id || target._id === member._id || !canChangeRole(member.role, target.role, args.role)) throw new ConvexError("Você não pode alterar este papel.");
    const account = await ctx.db.get(target.userId);
    if (!account || (args.role === "admin" && !hasApprovedAccess(account.status))) throw new ConvexError("Aprove o acesso antes de conceder administração.");
    if (canManage(target.role) && args.role === "member" && hasApprovedAccess(account.status) && await activeManagerCount(ctx, args.id) <= 1) throw new ConvexError("A comunidade precisa manter um gestor ativo.");
    await ctx.db.patch(target._id, { role: args.role }); return null;
  },
});
export const leave = mutation({
  args: { id: v.id("communities") }, returns: v.null(),
  handler: async (ctx, args) => {
    const { member } = await membership(ctx, args.id);
    const c = await ctx.db.get(args.id);
    if (member.role === "owner" || c?.ownerId === member.userId) throw new ConvexError("Transfira a posse antes de sair da comunidade.");
    if (canManage(member.role) && await activeManagerCount(ctx, args.id) <= 1) throw new ConvexError("A comunidade precisa manter um gestor ativo.");
    await ctx.db.delete(member._id); return null;
  },
});
export async function transferOwner(ctx: MutationCtx, id: Id<"communities">, memberId: Id<"communityMembers">) {
  const c = await ctx.db.get(id), target = await ctx.db.get(memberId);
  if (!c || !target || target.communityId !== id) throw new ConvexError("Membro não encontrado nesta comunidade.");
  const account = await ctx.db.get(target.userId);
  if (!account || !hasApprovedAccess(account.status)) throw new ConvexError("O novo responsável precisa ter acesso aprovado.");
  if (c.ownerId === target.userId) return;
  if (c.ownerId) {
    const previous = await ctx.db.query("communityMembers").withIndex("by_pair", q => q.eq("communityId", id).eq("userId", c.ownerId!)).unique();
    if (previous) await ctx.db.patch(previous._id, { role: "admin" });
  }
  await ctx.db.patch(target._id, { role: "owner" });
  await ctx.db.patch(id, { ownerId: target.userId });
}
export const transferOwnership = mutation({
  args: { id: v.id("communities"), memberId: v.id("communityMembers") }, returns: v.null(),
  handler: async (ctx, args) => {
    const { member } = await membership(ctx, args.id);
    const c = await ctx.db.get(args.id);
    if (member.role !== "owner" || c?.ownerId !== member.userId) throw new ConvexError("Só o responsável pode transferir a posse.");
    await transferOwner(ctx, args.id, args.memberId); return null;
  },
});
export const backfillOwners = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) }, returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("communities").paginate({ cursor: args.cursor, numItems: 25 });
    for (const c of page.page) {
      if (c.ownerId) continue;
      let migrated = false;
      for await (const member of ctx.db.query("communityMembers").withIndex("by_community", q => q.eq("communityId", c._id)).order("asc")) {
        if (!canManage(member.role)) continue;
        const account = await ctx.db.get(member.userId);
        if (!account || !hasApprovedAccess(account.status)) continue;
        await transferOwner(ctx, c._id, member._id); migrated = true; break;
      }
      if (!migrated) console.warn("Ownership migration requires an approved manager", c._id);
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("communityGovernance:backfillOwners"), { cursor: page.continueCursor });
    return null;
  },
});
