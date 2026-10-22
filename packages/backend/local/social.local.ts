import { randomUUID, randomInt } from "node:crypto";
import type { z } from "zod";
import type { LocalDatabase } from "./database.local";
import {
  friendPair,
  friendView,
  assertFriendCapacity,
  assertFriendChange,
  assertFriendRecipient,
  bibleQuote,
  privateShare,
  shareFingerprint,
  socialCommandSchema,
  shareFilterSchema,
  type FriendLink,
  type FriendsData,
  type ShareRecord,
  type SharePage,
  type ShareChapter,
  type ShareMarker,
} from "../../domain/index";
export class LocalSocial {
  constructor(
    private store: LocalDatabase,
    private changed: (id: string) => void,
  ) {
    store.db.exec(`
      CREATE TABLE IF NOT EXISTS friendCodes (userId TEXT PRIMARY KEY REFERENCES users(id), code TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS friendships (id TEXT PRIMARY KEY, low TEXT NOT NULL REFERENCES users(id), high TEXT NOT NULL REFERENCES users(id), requesterId TEXT NOT NULL REFERENCES users(id), state TEXT NOT NULL CHECK(state IN ('pending','accepted')), UNIQUE(low,high));
      CREATE INDEX IF NOT EXISTS friendships_high ON friendships(high);
      CREATE TABLE IF NOT EXISTS scriptureShares (id TEXT PRIMARY KEY, senderId TEXT NOT NULL REFERENCES users(id), requestId TEXT NOT NULL, fingerprint TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(senderId,requestId));
      CREATE TABLE IF NOT EXISTS shareViews (seq INTEGER PRIMARY KEY AUTOINCREMENT, ownerId TEXT NOT NULL REFERENCES users(id), shareId TEXT NOT NULL REFERENCES scriptureShares(id), direction TEXT NOT NULL, version TEXT NOT NULL, book TEXT NOT NULL, chapter INTEGER NOT NULL, first INTEGER NOT NULL, UNIQUE(ownerId,shareId));
      CREATE TABLE IF NOT EXISTS shareMarkers (ownerId TEXT NOT NULL REFERENCES users(id), version TEXT NOT NULL, book TEXT NOT NULL, chapter INTEGER NOT NULL, first INTEGER NOT NULL, direction TEXT NOT NULL, PRIMARY KEY(ownerId,version,book,chapter,first,direction));
      CREATE INDEX IF NOT EXISTS shareViews_marker ON shareViews(ownerId,version,book,chapter,first,direction,seq);
      CREATE INDEX IF NOT EXISTS shareViews_owner ON shareViews(ownerId,seq);
      CREATE INDEX IF NOT EXISTS shareViews_chapter ON shareViews(ownerId,version,book,chapter,seq);
      CREATE INDEX IF NOT EXISTS shareViews_direction ON shareViews(ownerId,direction,seq);
      CREATE INDEX IF NOT EXISTS shareViews_chapter_direction ON shareViews(ownerId,version,book,chapter,direction,seq);
    `);
  }
  private links(actor: string) {
    return this.store.all<FriendLink>(
      "SELECT * FROM friendships WHERE low=? OR high=? LIMIT 201",
      actor,
      actor,
    );
  }
  markers(actor: string, chapter: ShareChapter): ShareMarker[] {
    this.store.profile(actor);
    const c = shareFilterSchema.parse({ chapter, cursor: null }).chapter!;
    return this.store.all<ShareMarker>(
      "SELECT first,direction FROM shareMarkers WHERE ownerId=? AND version=? AND book=? AND chapter=? LIMIT 352",
      actor,
      c.version,
      c.book,
      c.chapter,
    );
  }
  private pair(actor: string, other: string) {
    const { low, high } = friendPair(actor, other);
    return this.store.get<FriendLink>(
      "SELECT * FROM friendships WHERE low=? AND high=?",
      low,
      high,
    );
  }
  friends(actor: string): FriendsData {
    this.store.profile(actor);
    return {
      userId: actor,
      code:
        this.store.get<{ code: string }>(
          "SELECT code FROM friendCodes WHERE userId=?",
          actor,
        )?.code ?? null,
      friends: this.links(actor).map((link) =>
        friendView(
          link,
          actor,
          this.store.profile(link.low === actor ? link.high : link.low).name,
          true,
        ),
      ),
    };
  }
  shares(actor: string, raw: z.infer<typeof shareFilterSchema>): SharePage {
    this.store.profile(actor);
    const input = shareFilterSchema.parse(raw);
    if (input.cursor !== null && !/^\d+$/.test(input.cursor))
      throw new Error("Página inválida.");
    const where = ["ownerId=?", "seq<?"],
      values: (string | number)[] = [
        actor,
        input.cursor ? Number(input.cursor) : Number.MAX_SAFE_INTEGER,
      ];
    if (input.direction) {
      where.push("direction=?");
      values.push(input.direction);
    }
    if (input.first) {
      if (!input.chapter) throw new Error("Informe o capítulo da marcação.");
      where.push("first=?");
      values.push(input.first);
    }
    if (input.chapter) {
      where.push("version=?", "book=?", "chapter=?");
      values.push(
        input.chapter.version,
        input.chapter.book,
        input.chapter.chapter,
      );
    }
    const rows = this.store.all<{ seq: number; data: string }>(
      `SELECT v.seq,s.data FROM shareViews v JOIN scriptureShares s ON s.id=v.shareId WHERE ${where.join(" AND ")} ORDER BY seq DESC LIMIT 31`,
      ...values,
    );
    return {
      items: rows
        .slice(0, 30)
        .map((row) => privateShare(JSON.parse(row.data) as ShareRecord, actor)),
      nextCursor: rows.length > 30 ? String(rows[29].seq) : null,
    };
  }
  // Called inside LocalDatabase's transaction; writes and SSE invalidation commit together.
  command(actor: string, raw: z.infer<typeof socialCommandSchema>) {
    const user = this.store.profile(actor),
      command = socialCommandSchema.parse(raw);
    if (command.kind === "rotateCode") {
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code: string;
      do {
        code = Array.from(
          { length: 12 },
          () => alphabet[randomInt(alphabet.length)],
        ).join("");
      } while (
        this.store.get("SELECT userId FROM friendCodes WHERE code=?", code)
      );
      this.store.run(
        "INSERT INTO friendCodes VALUES (?,?) ON CONFLICT(userId) DO UPDATE SET code=excluded.code",
        actor,
        code,
      );
      this.changed(actor);
      return code;
    }
    if (command.kind === "request") {
      const input = command.input;
      let other: string;
      if (input.kind === "code") {
        const row = this.store.get<{ userId: string }>(
          "SELECT userId FROM friendCodes WHERE code=?",
          input.code,
        );
        if (!row)
          throw new Error("Código indisponível. Peça um novo código à pessoa.");
        other = row.userId;
      } else {
        other = input.userId;
        for (const id of [actor, other])
          if (
            !this.store.get(
              "SELECT id FROM members WHERE communityId=? AND userId=?",
              input.communityId,
              id,
            )
          )
            throw new Error("Vocês precisam participar desta comunidade.");
      }
      this.store.profile(other);
      if (!this.store.isApproved(other)) throw new Error("Esta pessoa não está disponível para convites.");
      const pair = friendPair(actor, other);
      if (this.pair(actor, other)) return null;
      for (const id of [actor, other])
        assertFriendCapacity(this.links(id).length);
      this.store.run(
        "INSERT INTO friendships VALUES (?,?,?,?,'pending')",
        randomUUID(),
        pair.low,
        pair.high,
        actor,
      );
      this.changed(actor);
      this.changed(other);
      return null;
    }
    if (command.kind === "change") {
      const { id, action } = command.input,
        link = this.store.get<FriendLink>(
          "SELECT * FROM friendships WHERE id=?",
          id,
        );
      if (!link) throw new Error("Convite ou amizade não encontrado.");
      assertFriendChange(link, actor, action);
      if (action === "accept")
        this.store.run(
          "UPDATE friendships SET state='accepted' WHERE id=?",
          id,
        );
      else this.store.run("DELETE FROM friendships WHERE id=?", id);
      this.changed(link.low);
      this.changed(link.high);
      return null;
    }
    const input = command.input,
      fingerprint = shareFingerprint(input);
    const existing = this.store.get<{ id: string; fingerprint: string }>(
      "SELECT id,fingerprint FROM scriptureShares WHERE senderId=? AND requestId=?",
      actor,
      input.requestId,
    );
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new Error("Esta tentativa já foi usada para outro recado.");
      return existing.id;
    }
    const recipients = input.recipientIds.map((id) => {
      const other = this.store.profile(id);
      assertFriendRecipient(this.pair(actor, id), actor, id, this.store.isApproved(id));
      return { id, name: other.name };
    });
    const chapter = this.store.chapter(
      input.selection.book,
      input.selection.chapter,
      input.selection.version,
    );
    if (!chapter) throw new Error("Capítulo não encontrado.");
    const quote = bibleQuote(chapter, input.selection),
      id = randomUUID();
    const record: ShareRecord = {
      id,
      senderId: actor,
      senderName: user.name,
      recipients,
      quote,
      message: input.message,
      sentAt: this.store.now(),
    };
    this.store.run(
      "INSERT INTO scriptureShares VALUES (?,?,?,?,?)",
      id,
      actor,
      input.requestId,
      fingerprint,
      JSON.stringify(record),
    );
    for (const owner of [actor, ...input.recipientIds]) {
      const direction = owner === actor ? "sent" : "received";
      this.store.run(
        "INSERT INTO shareViews(ownerId,shareId,direction,version,book,chapter,first) VALUES (?,?,?,?,?,?,?)",
        owner,
        id,
        direction,
        quote.version,
        quote.book,
        quote.chapter,
        quote.first,
      );
      this.store.run(
        "INSERT OR IGNORE INTO shareMarkers VALUES (?,?,?,?,?,?)",
        owner,
        quote.version,
        quote.book,
        quote.chapter,
        quote.first,
        direction,
      );
      this.changed(owner);
    }
    for (const recipient of input.recipientIds) this.store.notices.friendShare(record, recipient);
    return id;
  }
}
