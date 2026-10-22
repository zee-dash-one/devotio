import { afterEach, describe, expect, it } from "vitest";
import { LocalDatabase } from "./database.local";
import type { CommunityDetail, JoinRequestPage } from "domain/core";
const stores: LocalDatabase[] = [];
afterEach(() => stores.splice(0).forEach(db => db.close()));
function setup() { const db = new LocalDatabase(":memory:"); stores.push(db); return db; }
describe("SQLite community governance", () => {
  it("migrates legacy roles and enforces permission and current ownership quota", () => {
    const db = setup();
    expect(db.get("SELECT ownerId FROM communities WHERE id='esperanca'")).toMatchObject({ ownerId: "daniel" });
    expect(db.get("SELECT role FROM members WHERE id='esperanca-daniel'")).toMatchObject({ role: "owner" });
    const create = { action: "createCommunity", input: { name: "New", description: "" } } as const;
    expect(() => db.command(db.profile("lucas"), create)).toThrow("permissão");
    expect(() => db.command(db.profile("daniel"), create)).toThrow("limite");
    db.command(db.profile("ester"), create);
    expect(() => db.command(db.profile("ester"), create)).toThrow("limite");
    db.governance.configureCreation("ester", false, 0);
    expect(db.governance.creation("ester").owned).toBe(2);
    expect(() => db.command(db.profile("ester"), create)).toThrow("permissão");
  });
  it("keeps pending applicants isolated and allows only local managers to decide", () => {
    const db = setup(), user = db.profile("lucas"), owner = db.profile("daniel");
    db.command(user, { action: "joinCommunity", code: "ESPERANC" });
    db.command(user, { action: "joinCommunity", code: "ESPERANC" });
    expect(db.all("SELECT * FROM communityJoinRequests")).toHaveLength(1);
    expect(() => db.query(user, { query: "community", id: "esperanca", cursor: null })).toThrow();
    const page = db.query(owner, { query: "governance", input: { kind: "requests", id: "esperanca", cursor: null } }) as JoinRequestPage;
    const input = { action: "governance", input: { kind: "decide", requestId: page.items[0].id, decision: "approve" } } as const;
    expect(() => db.command(db.profile("ester"), input)).toThrow();
    expect(() => db.command(db.profile("marina"), input)).toThrow();
    db.command(owner, input); db.command(owner, input);
    expect((db.query(user, { query: "community", id: "esperanca", cursor: null }) as CommunityDetail).community.role).toBe("member");
    expect(db.all("SELECT * FROM members WHERE communityId='esperanca' AND userId='lucas'")).toHaveLength(1);
  });
  it("supports refusal, resubmission and cancellation without creating membership", () => {
    const db = setup(), user = db.profile("lucas"), owner = db.profile("daniel");
    db.command(user, { action: "joinCommunity", code: "ESPERANC" });
    const page = () => db.query(user, { query: "governance", input: { kind: "mine", cursor: null } }) as JoinRequestPage;
    const requestId = page().items[0].id;
    db.command(owner, { action: "governance", input: { kind: "decide", requestId, decision: "reject" } });
    expect(page().items[0].state).toBe("rejected");
    db.command(user, { action: "joinCommunity", code: "ESPERANC" });
    expect(page().items[0].state).toBe("pending");
    expect(() => db.command(db.profile("marina"), { action: "governance", input: { kind: "cancel", requestId } })).toThrow();
    db.command(user, { action: "governance", input: { kind: "cancel", requestId } });
    expect(page().items[0].state).toBe("cancelled");
    expect(db.all("SELECT * FROM members WHERE userId='lucas'")).toHaveLength(0);
  });
  it("protects owner, restricts admin peers and releases the former owner's slot", () => {
    const db = setup(), owner = db.profile("daniel");
    expect(() => db.command(owner, { action: "governance", input: { kind: "leave", id: "esperanca" } })).toThrow("Transfira");
    db.command(owner, { action: "governance", input: { kind: "setRole", id: "esperanca", memberId: "esperanca-marina", role: "admin" } });
    expect(() => db.command(db.profile("marina"), { action: "removeMember", id: "esperanca", memberId: "esperanca-daniel" })).toThrow();
    db.command(owner, { action: "governance", input: { kind: "transfer", id: "esperanca", memberId: "esperanca-marina" } });
    expect(db.governance.creation("daniel")).toMatchObject({ owned: 0, canCreate: true });
    expect(() => db.command(owner, { action: "governance", input: { kind: "setRole", id: "esperanca", memberId: "esperanca-marina", role: "member" } })).toThrow();
    db.command(owner, { action: "governance", input: { kind: "leave", id: "esperanca" } });
    expect(() => db.query(owner, { query: "community", id: "esperanca", cursor: null })).toThrow();
  });
});
