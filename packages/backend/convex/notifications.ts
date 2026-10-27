import { ConvexError, v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { hasApprovedAccess } from "domain/core";
import { query, mutation, internalMutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./server";
import type { Doc } from "./_generated/dataModel";
import { findUser } from "./access";
import { notificationValidator } from "./notificationValidators";

type NoticeInput = Omit<Doc<"notifications">, "_id" | "_creationTime" | "readAt" | "hidden">;
export async function notify(ctx: MutationCtx, input: NoticeInput) {
  const previous = await ctx.db.query("notifications").withIndex("by_sourceKey", q => q.eq("sourceKey", input.sourceKey)).unique();
  if (previous) return;
  const user = await ctx.db.get(input.userId);
  if (!user) return;
  if (input.kind === "communityPost") {
    const member = input.recipientMembershipId && await ctx.db.get(input.recipientMembershipId);
    if (!member || member.userId !== input.userId || member.communityId !== input.communityId) return;
    await ctx.db.patch(member._id, { notificationUnread: (member.notificationUnread ?? 0) + 1 });
  }
  await ctx.db.insert("notifications", { ...input, readAt: null, hidden: false });
  await ctx.db.patch(user._id, { notificationUnread: (user.notificationUnread ?? 0) + 1 });
}
async function visible(ctx: QueryCtx, row: Doc<"notifications">) {
  if (row.hidden) return false;
  if (row.kind === "communityPost") {
    if (!row.communityId || !row.messageId || !row.recipientMembershipId) return false;
    const member = await ctx.db.query("communityMembers").withIndex("by_pair", q => q.eq("communityId", row.communityId!).eq("userId", row.userId)).unique();
    const message = await ctx.db.get(row.messageId);
    return member?._id === row.recipientMembershipId && message?.communityId === row.communityId && !!(await ctx.db.get(row.communityId));
  }
  if (row.kind === "friendShare") {
    const share = row.shareId && await ctx.db.get(row.shareId);
    return !!share && share.recipients.some(recipient => recipient.id === row.userId);
  }
  return true;
}
async function present(ctx: QueryCtx, row: Doc<"notifications">) {
  let available = true;
  if (row.kind === "communityAccepted") available = !!row.communityId && !!(await ctx.db.get(row.communityId)) && !!(await ctx.db.query("communityMembers").withIndex("by_pair", q => q.eq("communityId", row.communityId!).eq("userId", row.userId)).unique());
  return {
    id: row._id, type: row.kind === "communityPost" ? "community" as const : "system" as const,
    kind: row.kind, entity: row.kind === "friendShare" ? row.actorName ?? "Amigo" : row.communityName ?? "Devotio",
    actorName: row.actorName ?? null, communityId: row.communityId ?? null, communityName: row.communityName ?? null,
    messageId: row.messageId ?? null, shareId: row.shareId ?? null, target: row.target ?? null,
    text: row.text, createdAt: row._creationTime, readAt: row.readAt, available,
  };
}
export const summary = query({
  args: {}, returns: v.object({ unread: v.number(), capped: v.boolean(), revision: v.number() }),
  handler: async ctx => {
    const user = await findUser(ctx);
    const unread = user.notificationUnread ?? 0;
    return { unread: Math.min(unread, 100), capped: unread >= 100, revision: 0 };
  },
});
export const page = query({
  args: { cursor: v.union(v.string(), v.null()) }, returns: v.object({ items: v.array(notificationValidator), nextCursor: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    const user = await findUser(ctx);
    const result = await ctx.db.query("notifications").withIndex("by_userId_and_hidden", q => q.eq("userId", user._id).eq("hidden", false)).order("desc").paginate({ cursor: args.cursor, numItems: 30 });
    const items = [];
    for (const row of result.page) if (await visible(ctx, row)) items.push(await present(ctx, row));
    return { items, nextCursor: result.isDone ? null : result.continueCursor };
  },
});
export const markRead = mutation({
  args: { id: v.id("notifications") }, returns: v.null(),
  handler: async (ctx, args) => {
    const user = await findUser(ctx), row = await ctx.db.get(args.id);
    if (!row || row.userId !== user._id || !await visible(ctx, row)) throw new ConvexError("Notificação não encontrada.");
    if (row.readAt === null) {
      await ctx.db.patch(row._id, { readAt: Date.now() });
      await ctx.db.patch(user._id, { notificationUnread: Math.max(0, (user.notificationUnread ?? 0) - 1) });
      if (row.kind === "communityPost" && row.recipientMembershipId) {
        const member = await ctx.db.get(row.recipientMembershipId);
        if (member) await ctx.db.patch(member._id, { notificationUnread: Math.max(0, (member.notificationUnread ?? 0) - 1) });
      }
    }
    return null;
  },
});
export const fanOutPost = internalMutation({
  args: { messageId: v.id("communityMessages"), cursor: v.union(v.string(), v.null()) }, returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return null;
    const c = await ctx.db.get(message.communityId);
    if (!c) return null;
    const result = await ctx.db.query("communityMembers").withIndex("by_community", q => q.eq("communityId", c._id)).paginate({ cursor: args.cursor, numItems: 100 });
    for (const member of result.page) {
      if (member.userId === message.senderId || (member.joinSequence ?? 0) > (message.notificationAudienceVersion ?? 0)) continue;
      const user = await ctx.db.get(member.userId);
      if (!user || !hasApprovedAccess(user.status)) continue;
      await notify(ctx, { userId: member.userId, kind: "communityPost", communityId: c._id, communityName: c.name, messageId: message._id, recipientMembershipId: member._id, text: "Nova publicação", sourceKey: `post:${message._id}:${member.userId}` });
    }
    if (!result.isDone) await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("notifications:fanOutPost"), { ...args, cursor: result.continueCursor });
    return null;
  },
});
export async function hideMembership(ctx: MutationCtx, member: Doc<"communityMembers">) {
  const user = await ctx.db.get(member.userId);
  if (user) await ctx.db.patch(user._id, { notificationUnread: Math.max(0, (user.notificationUnread ?? 0) - (member.notificationUnread ?? 0)) });
  await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("notifications:hidePosts"), { memberId: member._id, cursor: null });
}
export const hidePosts = internalMutation({
  args: { memberId: v.id("communityMembers"), cursor: v.union(v.string(), v.null()) }, returns: v.null(),
  handler: async (ctx, args) => {
    const result = await ctx.db.query("notifications").withIndex("by_recipientMembershipId", q => q.eq("recipientMembershipId", args.memberId)).paginate({ cursor: args.cursor, numItems: 100 });
    for (const row of result.page) if (!row.hidden) await ctx.db.patch(row._id, { hidden: true });
    if (!result.isDone) await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("notifications:hidePosts"), { ...args, cursor: result.continueCursor });
    return null;
  },
});
export async function notifyRemoval(ctx: MutationCtx, member: Doc<"communityMembers">, communityName: string) {
  await hideMembership(ctx, member);
  await notify(ctx, { userId: member.userId, kind: "communityRemoved", communityId: member.communityId, communityName, text: "Você foi removido da comunidade.", sourceKey: `removed:${member._id}` });
}
