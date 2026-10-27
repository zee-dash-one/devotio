import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { refs } from "domain/convex";
import type { NotificationPage, NotificationSummary } from "domain/core";
import schema from "./convex/schema";
import type { Id } from "./convex/server";
import { addMember } from "./convex/communityGovernance";
import { notify } from "./convex/notifications";
const modules = {
  "./convex/_generated/server.ts": () => import("./convex/_generated/server"),
  "./convex/communities.ts": () => import("./convex/communities"),
  "./convex/communityGovernance.ts": () => import("./convex/communityGovernance"),
  "./convex/notifications.ts": () => import("./convex/notifications"),
  "./convex/social.ts": () => import("./convex/social"),
};
const m = (name: string) => makeFunctionReference<"mutation">(name);
const page = makeFunctionReference<"query", { cursor: string | null }, NotificationPage>("notifications:page");
const summary = makeFunctionReference<"query", Record<string, never>, NotificationSummary>("notifications:summary");
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const ids = [];
    for (const authId of ["owner", "ana", "bia", "other"]) ids.push(await ctx.db.insert("users", { authId, name: authId, email: `${authId}@example.test`, status: "approved", communityCreationAllowed: authId === "owner" }));
    for (const recipient of ids.slice(1, 3)) {
      const [low, high] = [ids[0], recipient].sort();
      await ctx.db.insert("friendships", { low, high, requesterId: ids[0], state: "accepted" });
    }
    return ids;
  });
  const actors = ["owner", "ana", "bia", "other"].map(subject => t.withIdentity({ subject }));
  const group = await actors[0].mutation(refs.create, { name: "Esperança", description: "" }) as Id<"communities">;
  return { t, ids, actors, group };
}
afterEach(() => vi.useRealTimers());
describe("Convex notifications", () => {
  it("resolves an old message directly only for current participants of its community", async () => {
    const { t, ids, actors, group } = await setup();
    const messageId = await t.run(async ctx => {
      await addMember(ctx, group, ids[1], "member");
      const id = await ctx.db.insert("communityMessages", { communityId: group, senderId: ids[0], content: "Old message", sentAt: 1 });
      for (let n = 0; n < 55; n++) await ctx.db.insert("communityMessages", { communityId: group, senderId: ids[0], content: String(n), sentAt: n + 2 });
      return id;
    });
    const target = makeFunctionReference<"query">("communities:message");
    expect(await actors[1].query(target, { id: group, messageId })).toMatchObject({ id: messageId, content: "Old message" });
    await expect(actors[3].query(target, { id: group, messageId })).rejects.toThrow();
    const detail = await actors[1].query(refs.detail, { id: group, cursor: null });
    expect(detail?.messages.some(message => message.id === messageId)).toBe(false);
  });
  it("notifies two recipients once with a canonical target and keeps private share history", async () => {
    const { t, ids, actors } = await setup();
    const input = { selection: { version: "alm1911", book: "jo", chapter: 3, first: 16, last: 17 }, recipientIds: [ids[1], ids[2]], message: "Private message", requestId: crypto.randomUUID() };
    await actors[0].mutation(m("social:send"), input);
    await actors[0].mutation(m("social:send"), input);
    expect((await actors[0].query(summary, {})).unread).toBe(0);
    const result = await actors[1].query(page, { cursor: null });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ kind: "friendShare", target: { version: "alm1911", book: "jo", chapter: 3, verse: 16 }, readAt: null });
    expect(JSON.stringify(result)).not.toContain("Private message");
    expect(JSON.stringify(result)).not.toContain(ids[2]);
    await expect(actors[2].mutation(m("notifications:markRead"), { id: result.items[0].id })).rejects.toThrow();
    await t.run(async ctx => { for (const link of await ctx.db.query("friendships").collect()) await ctx.db.delete(link._id); });
    expect((await actors[1].query(page, { cursor: null })).items).toHaveLength(1);
    expect((await actors[1].query(summary, {})).unread).toBe(1);
    await actors[1].mutation(m("notifications:markRead"), { id: result.items[0].id });
    await actors[1].mutation(m("notifications:markRead"), { id: result.items[0].id });
    expect((await actors[1].query(summary, {})).unread).toBe(0);
  });
  it("completes 250 recipients in batches, excludes author and late members even with a fixed clock", async () => {
    vi.useFakeTimers();
    const { t, ids, actors, group } = await setup();
    await t.run(async ctx => {
      for (let n = 0; n < 250; n++) {
        const userId = await ctx.db.insert("users", { name: `Member ${n}`, email: `${n}@example.test`, status: "approved" });
        await addMember(ctx, group, userId, "member");
      }
    });
    await actors[0].mutation(refs.send, { id: group, content: "A new publication" });
    const requestId = await t.run(ctx => ctx.db.insert("communityJoinRequests", { communityId: group, userId: ids[1], state: "pending", requestedAt: Date.now() }));
    await actors[0].mutation(m("communityGovernance:decideJoinRequest"), { requestId, decision: "approve" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const rows = await t.run(ctx => ctx.db.query("notifications").collect());
    expect(rows.filter(row => row.kind === "communityPost")).toHaveLength(250);
    expect(rows.some(row => row.userId === ids[0])).toBe(false);
    expect((await actors[1].query(page, { cursor: null })).items.map(item => item.kind)).toEqual(["communityAccepted"]);
    const message = await t.run(ctx => ctx.db.query("communityMessages").first());
    await t.mutation(m("notifications:fanOutPost"), { messageId: message!._id, cursor: null });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(ctx => ctx.db.query("notifications").collect())).toHaveLength(251);
  });
  it("keeps acceptance/removal readable and hides posts immediately without marking them read", async () => {
    vi.useFakeTimers();
    const { t, ids, actors, group } = await setup();
    const code = (await actors[0].query(refs.communities, {}))[0].inviteCode!;
    await actors[1].mutation(refs.join, { code });
    const request = await t.run(ctx => ctx.db.query("communityJoinRequests").first());
    await actors[0].mutation(m("communityGovernance:decideJoinRequest"), { requestId: request!._id, decision: "approve" });
    await actors[0].mutation(refs.send, { id: group, content: "Published" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const before = await actors[1].query(page, { cursor: null });
    const post = before.items.find(item => item.kind === "communityPost")!;
    const member = await t.run(ctx => ctx.db.query("communityMembers").withIndex("by_pair", q => q.eq("communityId", group).eq("userId", ids[1])).unique());
    await actors[0].mutation(refs.remove, { id: group, memberId: member!._id });
    expect((await actors[1].query(summary, {})).unread).toBe(2);
    expect((await actors[1].query(page, { cursor: null })).items.map(item => item.kind)).toEqual(["communityRemoved", "communityAccepted"]);
    await expect(actors[1].mutation(m("notifications:markRead"), { id: post.id })).rejects.toThrow();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(ctx => ctx.db.get(post.id as Id<"notifications">))).toMatchObject({ hidden: true, readAt: null });
    const removed = (await actors[1].query(page, { cursor: null })).items[0];
    await actors[1].mutation(m("notifications:markRead"), { id: removed.id });
    expect((await actors[1].query(summary, {})).unread).toBe(1);
    await actors[1].mutation(refs.join, { code });
    await actors[0].mutation(m("communityGovernance:decideJoinRequest"), { requestId: request!._id, decision: "approve" });
    expect((await actors[1].query(page, { cursor: null })).items.some(item => item.kind === "communityPost")).toBe(false);
    expect((await actors[1].query(summary, {})).unread).toBe(2);
  });
  it("caps unread counts, paginates, and denies pending/disabled accounts", async () => {
    const { t, ids, actors } = await setup();
    await t.run(async ctx => { for (let n = 0; n < 101; n++) await notify(ctx, { userId: ids[1], kind: "system", text: "Notice", sourceKey: `test:${n}` }); });
    expect(await actors[1].query(summary, {})).toMatchObject({ unread: 100, capped: true });
    const result = await actors[1].query(page, { cursor: null });
    expect(result.items).toHaveLength(30);
    expect(result.nextCursor).not.toBeNull();
    for (const item of result.items.slice(0, 2)) await actors[1].mutation(m("notifications:markRead"), { id: item.id });
    expect(await actors[1].query(summary, {})).toMatchObject({ unread: 99, capped: false });
    for (const status of ["pending", "disabled"] as const) {
      await t.run(ctx => ctx.db.patch(ids[1], { status }));
      await expect(actors[1].query(summary, {})).rejects.toThrow();
      await expect(actors[1].query(page, { cursor: null })).rejects.toThrow();
      await expect(actors[1].mutation(m("notifications:markRead"), { id: result.items[0].id })).rejects.toThrow();
    }
  });
});
