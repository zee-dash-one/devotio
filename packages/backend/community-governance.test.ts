import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { refs } from "domain/convex";
import type { JoinRequestPage } from "domain/core";
import schema from "./schema";
import type { Id } from "./server";
const modules = {
  "./_generated/server.ts": () => import("./_generated/server"),
  "./communities.ts": () => import("./communities"),
  "./communityGovernance.ts": () => import("./communityGovernance"),
};
const mutation = (name: string) => makeFunctionReference<"mutation">("communityGovernance:" + name);
const requests = makeFunctionReference<"query", { id: string; cursor: string | null }, JoinRequestPage>("communityGovernance:joinRequests");
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const result = [];
    for (const authId of ["owner", "applicant", "stranger"]) result.push(await ctx.db.insert("users", { authId, name: authId, email: `${authId}@example.test`, status: "approved", communityCreationAllowed: authId === "owner", communityCreationLimit: 1 }));
    return result;
  });
  const owner = t.withIdentity({ subject: "owner" });
  const applicant = t.withIdentity({ subject: "applicant" });
  const stranger = t.withIdentity({ subject: "stranger" });
  const id = await owner.mutation(refs.create, { name: "Group", description: "" });
  const code = (await owner.query(refs.communities, {}))[0].inviteCode!;
  return { t, ids, owner, applicant, stranger, id, code };
}
describe("connected community governance", () => {
  it("enforces creation permission and quota in the mutation", async () => {
    const { owner, applicant } = await setup();
    await expect(owner.mutation(refs.create, { name: "Second", description: "" })).rejects.toThrow("limite");
    await expect(applicant.mutation(refs.create, { name: "Unauthorized", description: "" })).rejects.toThrow("permissão");
  });
  it("keeps pending applicants out and checks the deciding community", async () => {
    const { t, owner, applicant, stranger, id, code } = await setup();
    await applicant.mutation(refs.join, { code });
    await applicant.mutation(refs.join, { code });
    expect(await applicant.query(refs.detail, { id, cursor: null })).toBeNull();
    await expect(applicant.mutation(refs.send, { id, content: "Forbidden" })).rejects.toThrow();
    await expect(stranger.query(requests, { id, cursor: null })).rejects.toThrow();
    const page = await owner.query(requests, { id, cursor: null });
    expect(page.items).toHaveLength(1);
    await expect(stranger.mutation(mutation("decideJoinRequest"), { requestId: page.items[0].id, decision: "approve" })).rejects.toThrow();
    await owner.mutation(mutation("decideJoinRequest"), { requestId: page.items[0].id, decision: "approve" });
    await owner.mutation(mutation("decideJoinRequest"), { requestId: page.items[0].id, decision: "approve" });
    expect((await applicant.query(refs.detail, { id, cursor: null }))?.community.role).toBe("member");
    expect(await t.run(ctx => ctx.db.query("communityMembers").collect())).toHaveLength(2);
  });
  it("protects owners, transfers ownership and releases quota", async () => {
    const { t, ids, owner, applicant, id, code } = await setup();
    await applicant.mutation(refs.join, { code });
    const request = (await owner.query(requests, { id, cursor: null })).items[0];
    await owner.mutation(mutation("decideJoinRequest"), { requestId: request.id, decision: "approve" });
    const detail = (await owner.query(refs.detail, { id, cursor: null }))!;
    const target = detail.members.find(m => m.userId === ids[1])!;
    const own = detail.members.find(m => m.userId === ids[0])!;
    await expect(owner.mutation(refs.remove, { id, memberId: own.id })).rejects.toThrow();
    await expect(owner.mutation(mutation("leave"), { id })).rejects.toThrow("Transfira");
    await owner.mutation(mutation("transferOwnership"), { id, memberId: target.id });
    expect(await t.run(ctx => ctx.db.get(id as Id<"communities">))).toMatchObject({ ownerId: ids[1] });
    await owner.mutation(refs.create, { name: "New slot", description: "" });
    await expect(owner.mutation(refs.remove, { id, memberId: target.id })).rejects.toThrow();
  });
  it("backfills the oldest active admin once and preserves existing members", async () => {
    const { t, ids } = await setup();
    const id = await t.run(async ctx => {
      const id = await ctx.db.insert("communities", { name: "Legacy", description: "", scripture: "", inviteCode: "LEGACY22", createdAt: 0 });
      await ctx.db.insert("communityMembers", { communityId: id, userId: ids[0], role: "admin" });
      await ctx.db.insert("communityMembers", { communityId: id, userId: ids[1], role: "admin" });
      return id;
    });
    await t.mutation(mutation("backfillOwners"), { cursor: null });
    await t.mutation(mutation("backfillOwners"), { cursor: null });
    expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ ownerId: ids[0] });
    const members = await t.run(ctx => ctx.db.query("communityMembers").withIndex("by_community", q => q.eq("communityId", id)).collect());
    expect(members.filter(m => m.role === "owner")).toHaveLength(1);
    expect(members).toHaveLength(2);
  });
});
