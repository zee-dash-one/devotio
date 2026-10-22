import { afterEach, describe, expect, it } from "vitest";
import { LocalDatabase } from "./database.local";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import type { FriendsData, JoinRequestPage, NotificationPage, LocalCommand } from "domain/core";
const stores: LocalDatabase[] = [];
afterEach(() => stores.splice(0).forEach(db => db.close()));
function setup() { const db = new LocalDatabase(":memory:"); stores.push(db); return db; }
function page(db: LocalDatabase, userId: string) { return db.query(db.profile(userId), { query: "notifications", cursor: null }) as NotificationPage; }
describe("SQLite notification events", () => {
  it("migrates legacy notices without losing read state and does not recreate fixed welcome notices", () => {
    const directory = mkdtempSync(join(tmpdir(), "devotio-notices-"));
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep) || !basename(directory).startsWith("devotio-notices-")) throw new Error("Unexpected test directory.");
    const path = join(directory, "legacy.sqlite"), raw = new DatabaseSync(path);
    raw.exec(`CREATE TABLE notifications (seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE,userId TEXT,type TEXT,entity TEXT,text TEXT,communityId TEXT,messageId TEXT,createdAt INTEGER,readAt INTEGER,sourceKey TEXT UNIQUE);
      INSERT INTO notifications VALUES (1,'legacy','marina','community','Esperança','Legacy notice','esperanca','welcome',1,123,'legacy-source');
      INSERT INTO notifications VALUES (2,'welcome-ester','ester','system','Devotio','Você tem direito a criar uma comunidade.',NULL,NULL,1,NULL,'welcome:ester');`);
    raw.close();
    let db: LocalDatabase | undefined;
    try {
      db = new LocalDatabase(path);
      expect(page(db, "marina").items).toEqual([expect.objectContaining({ id: "legacy", kind: "communityPost", readAt: 123 })]);
      expect(page(db, "ester").items).toHaveLength(0);
      db.close(); db = new LocalDatabase(path);
      expect(page(db, "marina").items[0].readAt).toBe(123);
      expect(page(db, "ester").items).toHaveLength(0);
    } finally { db?.close(); rmSync(directory, { recursive: true, force: true }); }
  });
  it("notifies friend recipients once and preserves notices after removing friendship", () => {
    const db = setup(), author = db.profile("daniel"), recipient = db.profile("marina");
    const code = db.command(recipient, { action: "social", input: { kind: "rotateCode" } }) as string;
    db.command(author, { action: "social", input: { kind: "request", input: { kind: "code", code } } });
    const link = (db.query(recipient, { query: "socialFriends" }) as FriendsData).friends[0];
    db.command(recipient, { action: "social", input: { kind: "change", input: { id: link.id, action: "accept" } } });
    const input: LocalCommand = { action: "social", input: { kind: "send", input: { selection: { version: "alm1911", book: "gn", chapter: 1, first: 1, last: 1 }, recipientIds: [recipient.id], message: "Private", requestId: crypto.randomUUID() } } };
    db.command(author, input); db.command(author, input);
    expect(page(db, recipient.id).items).toHaveLength(1);
    expect(page(db, recipient.id).items[0]).toMatchObject({ kind: "friendShare", target: { version: "alm1911", book: "gn", chapter: 1, verse: 1 } });
    expect(JSON.stringify(page(db, recipient.id))).not.toContain("Private");
    expect(page(db, author.id).items).toHaveLength(0);
    db.command(author, { action: "social", input: { kind: "change", input: { id: link.id, action: "remove" } } });
    expect(page(db, recipient.id).items).toHaveLength(1);
    expect(() => db.command(db.profile("lucas"), { action: "readNotification", id: page(db, recipient.id).items[0].id })).toThrow();
  });
  it("produces acceptance/removal, hides old participation posts and keeps voluntary exit quiet", () => {
    const db = setup(), owner = db.profile("daniel"), user = db.profile("lucas");
    const accept = () => {
      db.command(user, { action: "joinCommunity", code: "ESPERANC" });
      const request = (db.query(user, { query: "governance", input: { kind: "mine", cursor: null } }) as JoinRequestPage).items[0];
      db.command(owner, { action: "governance", input: { kind: "decide", requestId: request.id, decision: "approve" } });
    };
    accept();
    expect(page(db, user.id).items[0].kind).toBe("communityAccepted");
    db.command(owner, { action: "sendMessage", id: "esperanca", content: "New publication" });
    const post = page(db, user.id).items.find(item => item.kind === "communityPost")!;
    const member = db.get<{ id: string }>("SELECT id FROM members WHERE communityId='esperanca' AND userId='lucas'")!;
    db.command(owner, { action: "removeMember", id: "esperanca", memberId: member.id });
    expect(page(db, user.id).items.map(item => item.kind)).toEqual(["communityRemoved", "communityAccepted"]);
    expect(db.get("SELECT readAt,hidden FROM notifications WHERE id=?", post.id)).toMatchObject({ readAt: null, hidden: 1 });
    db.command(user, { action: "readNotification", id: page(db, user.id).items[0].id });
    accept();
    expect(page(db, user.id).items.filter(item => item.kind === "communityAccepted")).toHaveLength(2);
    expect(page(db, user.id).items.some(item => item.kind === "communityPost")).toBe(false);
    const before = page(db, user.id).items.length;
    db.command(user, { action: "governance", input: { kind: "leave", id: "esperanca" } });
    expect(page(db, user.id).items).toHaveLength(before);
  });
  it("requires approved access and does not mark a notice read when opening its page", () => {
    const db = setup(), user = db.profile("marina");
    db.command(db.profile("daniel"), { action: "sendMessage", id: "esperanca", content: "Notice" });
    const id = page(db, user.id).items[0].id;
    expect(db.notificationSummary(user.id).unread).toBe(1);
    db.command(user, { action: "readNotification", id });
    expect(db.notificationSummary(user.id).unread).toBe(0);
    db.run("UPDATE users SET data=json_set(data,'$.status','disabled') WHERE id=?", user.id);
    expect(() => page(db, user.id)).toThrow("desativado");
    expect(() => db.command(user, { action: "readNotification", id })).toThrow("desativado");
  });
});
