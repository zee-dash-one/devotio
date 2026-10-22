import { randomUUID } from "node:crypto";
import type { AppNotification, NotificationKind, NotificationPage, NotificationSummary, ShareRecord, Member } from "../../domain/index";
import { notificationTargetSchema } from "../../domain/validators/sharing";
import { LocalError, type LocalDatabase } from "./database.local";
type NoticeInput = {
  userId: string; kind: NotificationKind; text: string; sourceKey: string;
  actorName?: string; communityId?: string; communityName?: string; messageId?: string;
  recipientMembershipId?: string; shareId?: string; target?: NonNullable<AppNotification["target"]>;
};
type NoticeRow = Omit<AppNotification, "target"> & { seq: number; target: string | null };
// The same predicate protects pages, unread counts, and read mutations.
const visibleSql = `n.hidden=0
  AND (n.kind<>'communityPost' OR EXISTS(SELECT 1 FROM members m JOIN messages p ON p.id=n.messageId JOIN communities c ON c.id=m.communityId WHERE m.id=n.recipientMembershipId AND m.userId=n.userId AND m.communityId=n.communityId AND p.communityId=n.communityId))
  AND (n.kind<>'friendShare' OR EXISTS(SELECT 1 FROM scriptureShares s,json_each(s.data,'$.recipients') r WHERE s.id=n.shareId AND json_extract(r.value,'$.id')=n.userId))`;
export class LocalNotifications {
  constructor(private db: LocalDatabase) {
    if (db.get("SELECT 1 FROM metadata WHERE key='notifications-v2'")) return;
    db.transaction(() => {
      db.db.exec(`ALTER TABLE notifications ADD COLUMN kind TEXT;
        ALTER TABLE notifications ADD COLUMN actorName TEXT;
        ALTER TABLE notifications ADD COLUMN communityName TEXT;
        ALTER TABLE notifications ADD COLUMN shareId TEXT REFERENCES scriptureShares(id);
        ALTER TABLE notifications ADD COLUMN target TEXT;
        ALTER TABLE notifications ADD COLUMN recipientMembershipId TEXT;
        ALTER TABLE notifications ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1));
        UPDATE notifications SET kind=CASE type WHEN 'community' THEN 'communityPost' ELSE 'system' END;
        UPDATE notifications SET communityName=entity,recipientMembershipId=(SELECT id FROM members m WHERE m.communityId=notifications.communityId AND m.userId=notifications.userId) WHERE kind='communityPost';
        UPDATE notifications SET hidden=1 WHERE kind='communityPost' AND recipientMembershipId IS NULL;
        DELETE FROM notifications WHERE sourceKey LIKE 'welcome:%';
        CREATE INDEX notifications_visible ON notifications(userId,hidden,readAt,seq);
        CREATE INDEX notifications_membership ON notifications(recipientMembershipId);
        INSERT INTO metadata VALUES ('notifications-v2','1');`);
    });
  }
  private notify(input: NoticeInput) {
    const result = this.db.run("INSERT OR IGNORE INTO notifications(id,userId,type,kind,entity,text,communityId,communityName,actorName,messageId,shareId,target,recipientMembershipId,createdAt,sourceKey) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", randomUUID(), input.userId, input.kind === "communityPost" ? "community" : "system", input.kind, input.kind === "friendShare" ? input.actorName ?? "Amigo" : input.communityName ?? "Devotio", input.text, input.communityId ?? null, input.communityName ?? null, input.actorName ?? null, input.messageId ?? null, input.shareId ?? null, input.target ? JSON.stringify(notificationTargetSchema.parse(input.target)) : null, input.recipientMembershipId ?? null, this.db.now(), input.sourceKey);
    if (result.changes) this.db.notificationsChanged(input.userId);
  }
  summary(userId: string): NotificationSummary {
    const count = this.db.get<{ count: number }>(`SELECT COUNT(*) count FROM (SELECT 1 FROM notifications n WHERE n.userId=? AND n.readAt IS NULL AND ${visibleSql} LIMIT 100)`, userId)!.count;
    return { unread: count, capped: count >= 100, revision: Number(this.db.get<{ value: string }>("SELECT value FROM metadata WHERE key=?", "notifications:" + userId)?.value ?? 0) };
  }
  page(userId: string, cursor: string | null): NotificationPage {
    const rows = this.db.all<NoticeRow>(`SELECT n.* FROM notifications n WHERE n.userId=? AND n.seq<? AND ${visibleSql} ORDER BY n.seq DESC LIMIT 31`, userId, cursor ? Number(cursor) : Number.MAX_SAFE_INTEGER);
    const page = rows.slice(0, 30);
    return { items: page.map(row => ({
      id: row.id, type: row.type, kind: row.kind, entity: row.entity, text: row.text,
      communityId: row.communityId, communityName: row.communityName ?? null,
      actorName: row.actorName ?? null, messageId: row.messageId, shareId: row.shareId ?? null,
      target: row.target ? notificationTargetSchema.parse(JSON.parse(row.target)) : null,
      createdAt: row.createdAt, readAt: row.readAt,
      available: row.kind !== "communityAccepted" || !!this.db.get("SELECT 1 FROM members m JOIN communities c ON c.id=m.communityId WHERE m.userId=? AND m.communityId=?", userId, row.communityId),
    })), nextCursor: rows.length > 30 ? String(page.at(-1)!.seq) : null };
  }
  markRead(userId: string, id: string) {
    const row = this.db.get<{ readAt: number | null }>(`SELECT readAt FROM notifications n WHERE n.id=? AND n.userId=? AND ${visibleSql}`, id, userId);
    if (!row) throw new LocalError("Notificação não encontrada.", 404);
    if (row.readAt === null) { this.db.run("UPDATE notifications SET readAt=? WHERE id=? AND userId=?", this.db.now(), id, userId); this.db.notificationsChanged(userId); }
  }
  post(communityId: string, author: string, messageId: string) {
    const communityName = this.db.get<{ name: string }>("SELECT name FROM communities WHERE id=?", communityId)!.name;
    for (const member of this.db.all<Member>("SELECT m.* FROM members m JOIN users u ON u.id=m.userId WHERE m.communityId=? AND m.userId<>? AND COALESCE(json_extract(u.data,'$.status'),'approved')='approved'", communityId, author)) {
      this.notify({ userId: member.userId, kind: "communityPost", communityId, communityName, messageId, recipientMembershipId: member.id, text: "Nova publicação", sourceKey: `message:${messageId}:${member.userId}` });
    }
  }
  friendShare(record: ShareRecord, userId: string) {
    this.notify({ userId, kind: "friendShare", actorName: record.senderName, shareId: record.id, target: { version: record.quote.version, book: record.quote.book, chapter: record.quote.chapter, verse: record.quote.first }, text: record.quote.reference, sourceKey: `share:${record.id}:${userId}` });
  }
  accepted(userId: string, communityId: string, memberId: string) {
    const communityName = this.db.get<{ name: string }>("SELECT name FROM communities WHERE id=?", communityId)!.name;
    this.notify({ userId, kind: "communityAccepted", communityId, communityName, text: "Sua entrada foi aprovada.", sourceKey: `accepted:${memberId}` });
  }
  hideMembership(memberId: string, userId: string) {
    this.db.run("UPDATE notifications SET hidden=1 WHERE recipientMembershipId=? AND hidden=0", memberId);
    this.db.notificationsChanged(userId);
  }
  removed(member: Member, communityId: string) {
    const communityName = this.db.get<{ name: string }>("SELECT name FROM communities WHERE id=?", communityId)!.name;
    this.hideMembership(member.id, member.userId);
    this.notify({ userId: member.userId, kind: "communityRemoved", communityId, communityName, text: "Você foi removido da comunidade.", sourceKey: `removed:${member.id}` });
  }
}
