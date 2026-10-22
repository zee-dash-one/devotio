import type { z } from "zod";
import { randomUUID } from "node:crypto";
import { canCreateCommunity, canChangeRole, canManage, hasApprovedAccess, communityCreationSchema, type CreationPermission, type JoinRequest, type JoinRequestPage, type Member } from "../../domain/index";
import type { governanceCommandSchema, governanceQuerySchema } from "../../domain/validators/community";
import { LocalError, type LocalDatabase } from "./database.local";
export class LocalGovernance {
  constructor(private db: LocalDatabase) {
    if (db.get("SELECT 1 FROM metadata WHERE key='governance-v1'")) return;
    db.transaction(() => {
      db.db.exec(`ALTER TABLE communities ADD COLUMN ownerId TEXT REFERENCES users(id);
        ALTER TABLE members RENAME TO members_legacy;
        CREATE TABLE members (id TEXT PRIMARY KEY, communityId TEXT NOT NULL REFERENCES communities(id), userId TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK(role IN ('owner','admin','member')), UNIQUE(communityId,userId));
        INSERT INTO members SELECT * FROM members_legacy ORDER BY rowid;
        DROP TABLE members_legacy;
        CREATE INDEX members_community ON members(communityId);
        CREATE INDEX communities_owner ON communities(ownerId);
        CREATE TABLE communityJoinRequests (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, communityId TEXT NOT NULL REFERENCES communities(id), userId TEXT NOT NULL REFERENCES users(id), state TEXT NOT NULL CHECK(state IN ('pending','approved','rejected','cancelled')), requestedAt INTEGER NOT NULL, decidedAt INTEGER, decidedBy TEXT REFERENCES users(id), UNIQUE(communityId,userId));
        CREATE INDEX requests_community_state ON communityJoinRequests(communityId,state,seq);
        CREATE INDEX requests_user ON communityJoinRequests(userId,seq);`);
      for (const c of db.all<{ id: string }>("SELECT id FROM communities")) {
        const target = db.get<Member>("SELECT m.* FROM members m JOIN users u ON u.id=m.userId WHERE communityId=? AND role='admin' AND COALESCE(json_extract(u.data,'$.status'),'approved')='approved' ORDER BY m.rowid LIMIT 1", c.id);
        if (target) this.transfer(c.id, target.id);
      }
      for (const profile of ["daniel", "ester"]) this.configureCreation(profile, true, profile === "daniel" ? 1 : 2);
      db.run("DELETE FROM notifications WHERE sourceKey IN ('welcome:marina','welcome:lucas')");
      db.run("INSERT INTO metadata VALUES ('governance-v1','1')");
    });
  }
  configureCreation(userId: string, allowed: boolean, limit = 1) {
    const input = communityCreationSchema.parse({ userId, allowed, limit });
    const profile = this.db.profile(userId);
    this.db.run("UPDATE users SET data=? WHERE id=?", JSON.stringify({ ...profile, communityCreationAllowed: input.allowed, communityCreationLimit: input.limit }), userId);
  }
  creation(userId: string): CreationPermission {
    const values = this.db.get<{ allowed: number | null; limit: number | null }>("SELECT json_extract(data,'$.communityCreationAllowed') allowed,json_extract(data,'$.communityCreationLimit') 'limit' FROM users WHERE id=?", userId)!;
    const value = { allowed: values.allowed === 1, limit: values.limit ?? 1, owned: this.db.get<{ count: number }>("SELECT COUNT(*) count FROM communities WHERE ownerId=?", userId)!.count };
    return { ...value, canCreate: canCreateCommunity(value) && this.approved(userId) };
  }
  private approved(userId: string) {
    const row = this.db.get<{ status: "pending" | "approved" | "disabled" | null }>("SELECT json_extract(data,'$.status') status FROM users WHERE id=?", userId);
    return !!row && hasApprovedAccess(row.status ?? undefined);
  }
  private member(userId: string, id: string, manage = false) {
    const member = this.db.get<Member>("SELECT * FROM members WHERE userId=? AND communityId=?", userId, id);
    if (!this.approved(userId) || !member || (manage && !canManage(member.role))) throw new LocalError("Você não tem acesso a esta ação na comunidade.", 403);
    return member;
  }
  requestJoin(userId: string, code: string) {
    if (!this.approved(userId)) throw new LocalError("Seu acesso não está aprovado.", 403);
    const c = this.db.get<{ id: string }>("SELECT id FROM communities WHERE inviteCode=?", code);
    if (!c) throw new LocalError("Não encontramos uma comunidade com esse código.", 404);
    if (this.db.get("SELECT 1 FROM members WHERE communityId=? AND userId=?", c.id, userId)) return c.id;
    this.db.run("INSERT INTO communityJoinRequests(id,communityId,userId,state,requestedAt) VALUES (?,?,?,'pending',?) ON CONFLICT(communityId,userId) DO UPDATE SET state='pending',requestedAt=excluded.requestedAt,decidedAt=NULL,decidedBy=NULL WHERE state<>'pending'", randomUUID(), c.id, userId, this.db.now());
    return c.id;
  }
  query(userId: string, input: z.infer<typeof governanceQuerySchema>): CreationPermission | JoinRequestPage {
    if (!this.approved(userId)) throw new LocalError("Seu acesso não está aprovado.", 403);
    if (input.kind === "creation") return this.creation(userId);
    if (input.kind === "requests") this.member(userId, input.id, true);
    const rows = this.db.all<JoinRequest & { seq: number }>(`SELECT r.seq,r.id,r.communityId,c.name communityName,r.userId,json_extract(u.data,'$.name') name,r.state,r.requestedAt FROM communityJoinRequests r JOIN communities c ON c.id=r.communityId JOIN users u ON u.id=r.userId WHERE ${input.kind === "mine" ? "r.userId=?" : "r.communityId=? AND r.state='pending'"} AND r.seq<? ORDER BY r.seq DESC LIMIT 31`, input.kind === "mine" ? userId : input.id, input.cursor ? Number(input.cursor) : Number.MAX_SAFE_INTEGER);
    const page = rows.slice(0, 30);
    return { items: page.map(({ seq: _seq, ...r }) => r), cursor: rows.length > 30 ? String(page.at(-1)!.seq) : null };
  }
  managers(id: string) {
    return this.db.get<{ count: number }>("SELECT COUNT(*) count FROM members m JOIN users u ON u.id=m.userId WHERE communityId=? AND role IN ('owner','admin') AND COALESCE(json_extract(u.data,'$.status'),'approved')='approved'", id)!.count;
  }
  private transfer(id: string, memberId: string) {
    const target = this.db.get<Member>("SELECT * FROM members WHERE id=? AND communityId=?", memberId, id);
    if (!target || !this.approved(target.userId)) throw new LocalError("O novo responsável precisa participar e ter acesso aprovado.", 403);
    this.db.run("UPDATE members SET role='admin' WHERE communityId=? AND role='owner'", id);
    this.db.run("UPDATE members SET role='owner' WHERE id=?", target.id);
    this.db.run("UPDATE communities SET ownerId=? WHERE id=?", target.userId, id);
  }
  command(userId: string, input: z.infer<typeof governanceCommandSchema>) {
    if (!this.approved(userId)) throw new LocalError("Seu acesso não está aprovado.", 403);
    if (input.kind === "cancel" || input.kind === "decide") {
      const request = this.db.get<JoinRequest>("SELECT * FROM communityJoinRequests WHERE id=?", input.requestId);
      if (!request) throw new LocalError("Pedido não encontrado.", 404);
      if (input.kind === "cancel") {
        if (request.userId !== userId) throw new LocalError("Pedido não encontrado.", 403);
        this.db.run("UPDATE communityJoinRequests SET state='cancelled',decidedAt=? WHERE id=? AND state='pending'", this.db.now(), request.id);
      } else {
        this.member(userId, request.communityId, true);
        if (request.state !== "pending") return null;
        if (input.decision === "approve") {
          if (!this.approved(request.userId)) throw new LocalError("O solicitante precisa ter acesso aprovado.", 403);
          this.db.run("INSERT OR IGNORE INTO members VALUES (?,?,?,'member')", randomUUID(), request.communityId, request.userId);
        }
        this.db.run("UPDATE communityJoinRequests SET state=?,decidedAt=?,decidedBy=? WHERE id=?", input.decision === "approve" ? "approved" : "rejected", this.db.now(), userId, request.id);
      }
      return null;
    }
    const actor = this.member(userId, input.id, input.kind !== "leave");
    if (input.kind === "leave") {
      if (actor.role === "owner") throw new LocalError("Transfira a posse antes de sair da comunidade.", 403);
      if (canManage(actor.role) && this.managers(input.id) <= 1) throw new LocalError("A comunidade precisa manter um gestor ativo.", 403);
      this.db.run("DELETE FROM members WHERE id=?", actor.id); return null;
    }
    const target = this.db.get<Member>("SELECT * FROM members WHERE id=? AND communityId=?", input.memberId, input.id);
    if (!target || target.id === actor.id) throw new LocalError("Escolha outro participante desta comunidade.", 403);
    if (input.kind === "transfer") {
      if (actor.role !== "owner") throw new LocalError("Só o responsável pode transferir a posse.", 403);
      this.transfer(input.id, target.id); return null;
    }
    if (!canChangeRole(actor.role, target.role, input.role)) throw new LocalError("Você não pode alterar este papel.", 403);
    if (input.role === "admin" && !this.approved(target.userId)) throw new LocalError("O participante precisa ter acesso aprovado.", 403);
    if (canManage(target.role) && input.role === "member" && this.managers(input.id) <= 1) throw new LocalError("A comunidade precisa manter um gestor ativo.", 403);
    this.db.run("UPDATE members SET role=? WHERE id=?", input.role, target.id); return null;
  }
}
