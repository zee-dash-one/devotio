// Multiple-dot filename excludes this development module from Convex entry points.
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { LOCAL_SESSION_SECONDS } from "../../domain/local-cache";
import { alm1911Chapter } from "./alm1911.local";
import { bibleVersionNames, type BibleVersion } from "../../domain/validators/bible";
import { scriptureLicenseForVersion, editorialMonthDates, availableEditorialDates } from "../../domain/editorial";
import {
  bibleDatasetSchema, bibleBooksSchema, canManage, canRemoveMember, canPublish,
  isPublished, dateInZone, recentDates, isRecent, searchWords, publicationMidnight, canScheduleDate, scheduleSchema,
  type LocalProfile, type Devotional, type HomeData, type Community, type CommunityDetail,
  type Member, type Favorite, type BibleBook, type BibleChapter, type BibleResults,
  type BibleCatalog, type EditorialEntry, type LocalCommand, type LocalQuery, bibleQuote,
  type Message, type NotificationSummary, type NotificationPage, type CommunityQuoteDraft,
} from "../../domain/index";

export class LocalError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const profiles: LocalProfile[] = [
  { id: "daniel", name: "Daniel Almeida", label: "Liderança · AG", description: "Administra a Comunidade Esperança. Publica avisos e organiza listas.", editorial: false },
  { id: "marina", name: "Marina Oliveira", label: "Membro", description: "Participa da Esperança. Lê o mural e marca apenas seus próprios itens.", editorial: false },
  { id: "lucas", name: "Lucas Santos", label: "Leitor sem comunidade", description: "Leia, salve favoritos ou entre em um grupo com seu código.", editorial: false },
  { id: "ester", name: "Ester Costa", label: "Gestor do sistema", description: "Cria, programa, edita e retira devocionais locais. Papel independente da gestão de comunidades.", editorial: true },
];
type Row = Record<string, unknown>;
type PublicationRow = { data: string; publishedAt: number; withdrawn: number };
export class LocalDatabase {
  readonly db: DatabaseSync;
  private listeners = new Map<string, Set<(summary: NotificationSummary) => void>>();
  private changedNotifications = new Set<string>();
  private removedFavorites = new Map<string, { token: string; favorite: Favorite }>();
  constructor(path: string, bibleDirectory?: string, readonly now = () => Date.now()) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id), expiresAt INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS communities (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, scripture TEXT NOT NULL DEFAULT '', inviteCode TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, communityId TEXT NOT NULL REFERENCES communities(id), userId TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK(role IN ('admin','member')), UNIQUE(communityId,userId));
      CREATE TABLE IF NOT EXISTS messages (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, communityId TEXT NOT NULL REFERENCES communities(id), userId TEXT NOT NULL REFERENCES users(id), content TEXT NOT NULL, sentAt INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS notifications (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, userId TEXT NOT NULL REFERENCES users(id), type TEXT NOT NULL CHECK(type IN ('system','community')), entity TEXT NOT NULL, text TEXT NOT NULL, communityId TEXT REFERENCES communities(id), messageId TEXT REFERENCES messages(id), createdAt INTEGER NOT NULL, readAt INTEGER, sourceKey TEXT UNIQUE NOT NULL);
      CREATE INDEX IF NOT EXISTS notifications_user ON notifications(userId,seq);
      CREATE INDEX IF NOT EXISTS messages_group ON messages(communityId,seq);
      CREATE TABLE IF NOT EXISTS quoteDrafts (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id), communityId TEXT NOT NULL REFERENCES communities(id), requestId TEXT NOT NULL, quote TEXT NOT NULL, comment TEXT NOT NULL DEFAULT '', createdAt INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published','discarded')), UNIQUE(userId,communityId,requestId));
      CREATE INDEX IF NOT EXISTS quoteDrafts_owner ON quoteDrafts(userId,communityId,createdAt);
      CREATE TABLE IF NOT EXISTS checklists (id TEXT PRIMARY KEY, communityId TEXT NOT NULL REFERENCES communities(id), name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, listId TEXT NOT NULL REFERENCES checklists(id), text TEXT NOT NULL, position INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS ticks (itemId TEXT NOT NULL REFERENCES items(id), userId TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(itemId,userId));
      CREATE TABLE IF NOT EXISTS devotionals (date TEXT PRIMARY KEY, data TEXT NOT NULL, publishedAt INTEGER NOT NULL, withdrawn INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS favorites (userId TEXT NOT NULL REFERENCES users(id), date TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(userId,date));
      CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, date TEXT NOT NULL, reason TEXT NOT NULL, at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS bibleBooks (abbrev TEXT PRIMARY KEY, data TEXT NOT NULL, bookOrder INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS bibleVerses (id INTEGER PRIMARY KEY, abbrev TEXT NOT NULL REFERENCES bibleBooks(abbrev), chapter INTEGER NOT NULL, number INTEGER NOT NULL, text TEXT NOT NULL, UNIQUE(abbrev,chapter,number));
      CREATE VIRTUAL TABLE IF NOT EXISTS bibleSearch USING fts5(text, content='bibleVerses', content_rowid='id', tokenize='unicode61 remove_diacritics 2');
      PRAGMA user_version=3;`);
    if (!this.all<{ name: string }>("PRAGMA table_info(messages)").some(column => column.name === "quote")) this.db.exec("ALTER TABLE messages ADD COLUMN quote TEXT");
    if (!this.all<{ name: string }>("PRAGMA table_info(quoteDrafts)").some(column => column.name === "state")) this.db.exec("ALTER TABLE quoteDrafts ADD COLUMN state TEXT NOT NULL DEFAULT 'draft'");
    if (bibleDirectory && existsSync(join(bibleDirectory, "aa.json"))) this.importBible(bibleDirectory);
    this.seed();
  }
  get<T = Row>(sql: string, ...args: SQLInputValue[]): T | undefined { return this.db.prepare(sql).get(...args) as T | undefined; }
  all<T = Row>(sql: string, ...args: SQLInputValue[]): T[] { return this.db.prepare(sql).all(...args) as T[]; }
  run(sql: string, ...args: SQLInputValue[]) { return this.db.prepare(sql).run(...args); }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn(); this.db.exec("COMMIT");
      const changed = [...this.changedNotifications]; this.changedNotifications.clear();
      for (const userId of changed) this.publishSummary(userId);
      return value;
    }
    catch (error) { this.changedNotifications.clear(); this.db.exec("ROLLBACK"); throw error; }
  }
  close() { this.listeners.clear(); this.removedFavorites.clear(); this.db.close(); }
  subscribeNotifications(userId: string, listener: (summary: NotificationSummary) => void) {
    const set = this.listeners.get(userId) ?? new Set(); set.add(listener); this.listeners.set(userId, set);
    return () => { set.delete(listener); if (!set.size) this.listeners.delete(userId); };
  }
  private publishSummary(userId: string) {
    const listeners = this.listeners.get(userId);
    if (listeners?.size) {
      const summary = this.notificationSummary(userId);
      // A disconnected transport must never turn a committed write into an error.
      for (const listener of listeners) { try { listener(summary); } catch { listeners.delete(listener); } }
    }
  }
  private notificationsChanged(userId: string) {
    this.run("INSERT INTO metadata(key,value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value=CAST(value AS INTEGER)+1", "notifications:" + userId);
    this.changedNotifications.add(userId);
  }
  notificationSummary(userId: string): NotificationSummary {
    return { revision: Number(this.get<{ value: string }>("SELECT value FROM metadata WHERE key=?", "notifications:" + userId)?.value ?? 0), unread: this.get<{ count: number }>("SELECT COUNT(*) count FROM notifications n WHERE userId=? AND readAt IS NULL AND (communityId IS NULL OR EXISTS(SELECT 1 FROM members m WHERE m.userId=n.userId AND m.communityId=n.communityId))", userId)!.count };
  }
  private communityNotice(communityId: string, author: string, messageId: string) {
    const entity = this.get<{ name: string }>("SELECT name FROM communities WHERE id=?", communityId)!.name;
    for (const member of this.all<{ userId: string }>("SELECT userId FROM members WHERE communityId=? AND userId<>?", communityId, author)) {
      this.run("INSERT INTO notifications(id,userId,type,entity,text,communityId,messageId,createdAt,readAt,sourceKey) VALUES (?,?,'community',?,'Nova mensagem para comunidade',?,?,?,NULL,?)", randomUUID(), member.userId, entity, communityId, messageId, this.now(), `message:${messageId}:${member.userId}`);
      this.notificationsChanged(member.userId);
    }
  }
  importBible(directory: string) {
    const raw = readFileSync(join(directory, "aa.json"), "utf8").replace(/^\uFEFF/, "");
    const hash = createHash("sha256").update(raw).digest("hex");
    if (this.get<{ value: string }>("SELECT value FROM metadata WHERE key='bibleHash'")?.value === hash) return;
    const data = bibleDatasetSchema.parse(JSON.parse(raw));
    const catalog = bibleBooksSchema.parse(JSON.parse(readFileSync(join(directory, "books.json"), "utf8").replace(/^\uFEFF/, "")));
    const revision = readFileSync(join(directory, "revision.txt"), "utf8").trim();
    if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("Commit da fonte bíblica inválido.");
    if (new Set(data.map(b => b.abbrev)).size !== 66) throw new Error("Livros bíblicos duplicados.");
    const total = data.reduce((sum, book) => sum + book.chapters.reduce((n, verses) => n + verses.length, 0), 0);
    if (total !== 31104) throw new Error("A edição AA deve conter 31.104 versículos; confira a fonte antes de atualizar.");
    this.transaction(() => {
      this.run("DELETE FROM bibleVerses"); this.run("DELETE FROM bibleBooks");
      const bookInsert = this.db.prepare("INSERT INTO bibleBooks VALUES (?,?,?)");
      const verseInsert = this.db.prepare("INSERT INTO bibleVerses(abbrev,chapter,number,text) VALUES (?,?,?,?)");
      data.forEach((book, order) => {
        // The provider's AA file uses 'jó'/'atos'; its API catalog uses 'job'/'at'.
        const abbrev = ({ "jó": "job", atos: "at" } as Record<string, string>)[book.abbrev] ?? book.abbrev;
        const metadata = catalog.find(b => b.abbrev.pt === abbrev) ?? catalog.find(b => b.abbrev.en === abbrev);
        // Confirmed catalog defects (04/10/2026): Titus says 2, Philemon says 4.
        // The official AA text has the complete 3 and 1 chapters respectively.
        const knownChapterCount = ({ tt: 3, fm: 1 } as Record<string, number>)[abbrev];
        if (!metadata || (knownChapterCount ?? metadata.chapters) !== book.chapters.length) throw new Error("Catálogo e texto divergentes: " + book.abbrev);
        const value: BibleBook = { abbrev: metadata.abbrev.pt, name: metadata.name, chapters: book.chapters.length, testament: metadata.testament, order };
        bookInsert.run(value.abbrev, JSON.stringify(value), order);
        book.chapters.forEach((verses, chapter) => verses.forEach((text, number) => verseInsert.run(value.abbrev, chapter + 1, number + 1, text)));
      });
      this.run("INSERT INTO bibleSearch(bibleSearch) VALUES('rebuild')");
      for (const [key, value] of Object.entries({ bibleHash: hash, bibleRevision: revision, bibleImportedAt: String(this.now()), bibleSource: `https://github.com/omarcoscardoso/abibliadigital-api-br/blob/${revision}/data/json/pt_aa.json` })) {
        this.run("INSERT OR REPLACE INTO metadata VALUES (?,?)", key, value);
      }
    });
  }
  private seed() {
    this.transaction(() => {
      for (const profile of profiles) this.run("INSERT OR IGNORE INTO users VALUES (?,?)", profile.id, JSON.stringify(profile));
      for (const profile of profiles) {
        const result = this.run("INSERT OR IGNORE INTO notifications(id,userId,type,entity,text,createdAt,sourceKey) VALUES (?,?,'system','Devotio','Você tem direito a criar uma comunidade.',?,?)", "welcome-" + profile.id, profile.id, this.now(), "welcome:" + profile.id);
        if (result.changes) this.notificationsChanged(profile.id);
      }
      // Refresh the known mock profile's presentation without replacing account data or memberships.
      const editor = this.profile("ester");
      this.run("UPDATE users SET data=? WHERE id='ester'", JSON.stringify({ ...editor, label: profiles[3].label, description: profiles[3].description }));
      if (!this.get("SELECT value FROM metadata WHERE key='seed'")) {
        this.run("INSERT INTO communities VALUES ('esperanca','Comunidade Esperança','Um espaço para caminhar juntos na fé, no cuidado e na oração.','Que o amor seja o princípio de tudo o que fazemos.','ESPERANC')");
        this.run("INSERT INTO communities VALUES ('caminho','Comunidade Caminho','Outro grupo para verificar o isolamento de acesso.','','CAMINHOS')");
        for (const [group, user, role] of [["esperanca", "daniel", "admin"], ["esperanca", "marina", "member"], ["caminho", "ester", "admin"]]) {
          this.run("INSERT INTO members VALUES (?,?,?,?)", `${group}-${user}`, group, user, role);
        }
        this.run("INSERT INTO messages(id,communityId,userId,content,sentAt) VALUES ('welcome','esperanca','daniel',?,?)", "Seja bem-vindo. Este mural de demonstração é um espaço de cuidado e oração. Experimente também as listas da comunidade.", this.now());
        this.run("INSERT INTO checklists VALUES ('prayer','esperanca','Para levar em oração')");
        ["Pelas famílias da nossa comunidade", "Por quem precisa de acolhimento", "Por sabedoria nas pequenas decisões"].forEach((text, i) => this.run("INSERT INTO items VALUES (?,?,?,?)", `prayer-${i}`, "prayer", text, i));
        this.run("INSERT INTO metadata VALUES ('seed','1')");
      }
      recentDates(dateInZone(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date(this.now()))).forEach((date, index) => {
        const verse = this.get<{ text: string }>("SELECT text FROM bibleVerses WHERE abbrev='sl' AND chapter=23 AND number=?", index % 6 + 1);
        const devotional: Devotional = {
          id: date, date, reference: verse ? `Salmos 23:${index % 6 + 1}` : "Leitura de demonstração", translation: verse ? "AA · ABíbliaDigital" : "Texto ilustrativo",
          scripture: verse?.text ?? "Um espaço para acolher a Palavra e encontrar descanso.",
          reflection: "Esta é uma reflexão ilustrativa para experimentar a leitura no Devotio. Faça uma pausa e leia o texto com atenção.\n\nO ambiente de desenvolvimento permite testar a publicação, os favoritos e a convivência em comunidade. Este conteúdo não recebeu revisão pastoral para publicação.",
          prayerSuggestion: "Senhor, ensina-me a escutar com atenção e a cuidar de quem está perto. Que eu encontre espaço para a tua Palavra neste dia. Amém.",
          credit: "Conteúdo de demonstração local. Reflexão e oração ilustrativas, sem revisão pastoral.",
        };
        this.run("INSERT OR IGNORE INTO devotionals VALUES (?,?,?,0)", date, JSON.stringify(devotional), this.now() - 86400000);
      });
    });
  }
  profile(id: string) {
    const row = this.get<{ data: string }>("SELECT data FROM users WHERE id=?", id);
    if (!row) throw new LocalError("Perfil não encontrado.", 401);
    return JSON.parse(row.data) as LocalProfile;
  }
  session(token?: string): LocalProfile | null {
    if (!token) return null;
    const row = this.get<{ userId: string }>("SELECT userId FROM sessions WHERE token=? AND expiresAt>?", token, this.now());
    return row ? this.profile(row.userId) : null;
  }
  login(id: string) {
    const profile = this.profile(id), token = randomUUID();
    this.run("DELETE FROM sessions WHERE expiresAt<=?", this.now());
    const expiresAt = this.now() + LOCAL_SESSION_SECONDS * 1000;
    this.run("INSERT INTO sessions VALUES (?,?,?)", token, id, expiresAt);
    return { token, profile, expiresAt };
  }
  sessionExpiresAt(token?: string): number | null {
    return token ? this.get<{ expiresAt: number }>("SELECT expiresAt FROM sessions WHERE token=? AND expiresAt>?", token, this.now())?.expiresAt ?? null : null;
  }
  logout(token: string) { const user = this.session(token); this.run("DELETE FROM sessions WHERE token=?", token); if (user) { this.removedFavorites.delete(user.id); this.publishSummary(user.id); } }
  private membership(userId: string, id: string, manage = false) {
    const member = this.get<Member>("SELECT id,userId,role FROM members WHERE userId=? AND communityId=?", userId, id);
    if (!member) throw new LocalError("Esta comunidade não está disponível para sua conta.", 403);
    if (manage && !canManage(member.role)) throw new LocalError("Apenas a liderança pode realizar esta ação.", 403);
    return member;
  }
  private editor(user: LocalProfile) { if (!canPublish(this.profile(user.id).editorial)) throw new LocalError("Acesso editorial exclusivo do Gestor do sistema.", 403); }
  private published(date: string, timeZone: string): Devotional | null {
    if (!isRecent(date, dateInZone(timeZone, new Date(this.now())))) throw new LocalError("Esta data está fora da janela de leitura.", 403);
    const row = this.get<PublicationRow>("SELECT data,publishedAt,withdrawn FROM devotionals WHERE date=?", date);
    return row && isPublished(row.publishedAt, !!row.withdrawn, this.now()) ? JSON.parse(row.data) as Devotional : null;
  }
  query(user: LocalProfile, input: LocalQuery): unknown {
    switch (input.query) {
      case "session": return user;
      case "devotionals": return Object.fromEntries(input.dates.map(date => [date, this.query(user, { query: "home", date, timeZone: input.timeZone })]));
      case "home": return { user, devotional: this.published(input.date, input.timeZone), settings: { monthlyVerse: "Um coração atento ao que permanece.", monthlyReference: "Tema ilustrativo do mês", weeklyVerse: "Caminhar com presença e cuidado.", weeklyReference: "Tema ilustrativo da semana" } } satisfies HomeData;
      case "reading": return { dates: recentDates(dateInZone(input.timeZone, new Date(this.now()))), favorites: this.all<{ data: string }>("SELECT data FROM favorites WHERE userId=? ORDER BY date DESC", user.id).map(r => JSON.parse(r.data) as Favorite) };
      case "communities": return this.all<Community>("SELECT c.*,m.role FROM communities c JOIN members m ON m.communityId=c.id WHERE m.userId=? ORDER BY c.name", user.id).map(c => ({ ...c, inviteCode: canManage(c.role) ? c.inviteCode : undefined }));
      case "invite": return this.get("SELECT id,name FROM communities WHERE inviteCode=?", input.code) ?? null;
      case "community": return this.detail(user.id, input.id, input.cursor);
      case "communityMessage": {
        this.membership(user.id, input.id);
        const row = this.get<Message & { quote: string | null }>("SELECT m.id,m.content,m.quote,json_extract(u.data,'$.name') name,m.sentAt FROM messages m JOIN users u ON u.id=m.userId WHERE m.id=? AND m.communityId=?", input.messageId, input.id);
        if (!row) throw new LocalError("Mensagem não encontrada.", 404);
        return { ...row, quote: row.quote ? JSON.parse(row.quote) : undefined } satisfies Message;
      }
      case "quoteDrafts": {
        this.membership(user.id, input.id, true);
        return this.all<Omit<CommunityQuoteDraft, "quote"> & { quote: string }>("SELECT id,communityId,quote,comment,createdAt FROM quoteDrafts WHERE userId=? AND communityId=? AND state='draft' ORDER BY createdAt DESC,rowid DESC", user.id, input.id).map(row => ({ ...row, quote: JSON.parse(row.quote) as CommunityQuoteDraft["quote"] }));
      }
      case "notificationSummary": return this.notificationSummary(user.id);
      case "notifications": {
        const rows = this.all<NotificationPage["items"][number] & { seq: number }>("SELECT seq,id,type,entity,text,communityId,messageId,createdAt,readAt FROM notifications n WHERE userId=? AND seq<? AND (communityId IS NULL OR EXISTS(SELECT 1 FROM members m WHERE m.userId=n.userId AND m.communityId=n.communityId)) ORDER BY seq DESC LIMIT 31", user.id, input.cursor ? Number(input.cursor) : Number.MAX_SAFE_INTEGER);
        const page = rows.slice(0, 30);
        return { items: page.map(({ seq: _seq, ...item }) => item), nextCursor: rows.length > 30 ? String(page.at(-1)!.seq) : null } satisfies NotificationPage;
      }
      case "bible": return this.catalog();
      case "chapter": return this.chapter(input.abbrev, input.chapter);
      case "search": return this.search(input.text, input.page);
      case "editorial": {
        this.editor(user);
        return this.all<PublicationRow>("SELECT data,publishedAt,withdrawn FROM devotionals ORDER BY date DESC LIMIT 100").map(r => ({ devotional: JSON.parse(r.data) as Devotional, withdrawn: !!r.withdrawn, publishedAt: r.publishedAt } satisfies EditorialEntry));
      }
      case "editorialCalendar": {
        this.editor(user);
        const dates = editorialMonthDates(input.month);
        const rows = this.all<{ date: string }>("SELECT date FROM devotionals WHERE date>=? AND date<=? ORDER BY date", dates[0], dates.at(-1)!);
        return availableEditorialDates(input.month, rows.map(row => row.date), input.today);
      }
    }
  }
  command(user: LocalProfile, input: LocalCommand): unknown {
    return this.transaction(() => {
      switch (input.action) {
        case "login": case "logout": throw new LocalError("Operação de sessão inválida.");
        case "createCommunity": {
          const id = randomUUID(), code = Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[parseInt(randomUUID().slice(0, 8), 16) % 31]).join("");
          this.run("INSERT INTO communities VALUES (?,?,?,'',?)", id, input.input.name, input.input.description, code);
          this.run("INSERT INTO members VALUES (?,?,?,'admin')", randomUUID(), id, user.id);
          return id;
        }
        case "joinCommunity": {
          const group = this.get<{ id: string }>("SELECT id FROM communities WHERE inviteCode=?", input.code);
          if (!group) throw new LocalError("Não encontramos uma comunidade com esse código.", 404);
          this.run("INSERT OR IGNORE INTO members VALUES (?,?,?,'member')", randomUUID(), group.id, user.id);
          return group.id;
        }
        case "sendMessage": {
          this.membership(user.id, input.id, true); const messageId = randomUUID();
          this.run("INSERT INTO messages(id,communityId,userId,content,sentAt) VALUES (?,?,?,?,?)", messageId, input.id, user.id, input.content, this.now());
          this.communityNotice(input.id, user.id, messageId); return null;
        }
        case "saveQuoteDrafts": {
          const chapter = this.chapter(input.selection.book, input.selection.chapter, input.selection.version);
          if (!chapter) throw new LocalError("Capítulo não encontrado.", 404);
          const quote = JSON.stringify(bibleQuote(chapter, input.selection));
          for (const id of input.ids) {
            this.membership(user.id, id, true);
            const previous = this.get<{ quote: string; state: string }>("SELECT quote,state FROM quoteDrafts WHERE userId=? AND communityId=? AND requestId=?", user.id, id, input.requestId);
            if (previous) {
              if (previous.state !== "draft") throw new LocalError("Este envio já foi publicado ou descartado. Selecione novamente para criar outro rascunho.", 409);
              if (previous.quote !== quote) throw new LocalError("Este envio já foi utilizado para outro trecho.", 409);
              continue;
            }
            const count = this.get<{ count: number }>("SELECT COUNT(*) count FROM quoteDrafts WHERE userId=? AND communityId=? AND state='draft'", user.id, id)!.count;
            if (count >= 100) throw new LocalError("Publique ou descarte um dos 100 rascunhos desta comunidade antes de enviar outro.");
            this.run("INSERT INTO quoteDrafts(id,userId,communityId,requestId,quote,createdAt) VALUES (?,?,?,?,?,?)", randomUUID(), user.id, id, input.requestId, quote, this.now());
          }
          return input.ids.map(id => {
            const row = this.get<Omit<CommunityQuoteDraft, "quote"> & { quote: string }>("SELECT id,communityId,quote,comment,createdAt FROM quoteDrafts WHERE userId=? AND communityId=? AND requestId=?", user.id, id, input.requestId)!;
            return { ...row, quote: JSON.parse(row.quote) as CommunityQuoteDraft["quote"] };
          });
        }
        case "deleteQuoteDraft": {
          this.membership(user.id, input.id, true);
          this.run("UPDATE quoteDrafts SET state='discarded',quote='{}',comment='' WHERE id=? AND userId=? AND communityId=? AND state='draft'", input.draftId, user.id, input.id); return null;
        }
        case "updateQuoteDraft": case "publishQuoteDraft": {
          this.membership(user.id, input.id, true);
          const chapter = this.chapter(input.selection.book, input.selection.chapter, input.selection.version);
          if (!chapter) throw new LocalError("Capítulo não encontrado.", 404);
          const quote = JSON.stringify(bibleQuote(chapter, input.selection));
          const draft = this.get("SELECT id FROM quoteDrafts WHERE id=? AND userId=? AND communityId=? AND state='draft'", input.draftId, user.id, input.id);
          if (!draft) {
            const previous = this.get<{ userId: string; communityId: string; quote: string; content: string }>("SELECT userId,communityId,quote,content FROM messages WHERE id=?", input.draftId);
            if (input.action === "publishQuoteDraft" && previous?.userId === user.id && previous.communityId === input.id && previous.quote === quote && previous.content === input.comment) return null;
            throw new LocalError("Rascunho não encontrado.", 404);
          }
          if (input.action === "updateQuoteDraft") this.run("UPDATE quoteDrafts SET quote=?,comment=? WHERE id=?", quote, input.comment, input.draftId);
          else {
            this.run("INSERT INTO messages(id,communityId,userId,content,sentAt,quote) VALUES (?,?,?,?,?,?)", input.draftId, input.id, user.id, input.comment, this.now(), quote);
            this.run("UPDATE quoteDrafts SET state='published',quote='{}',comment='' WHERE id=?", input.draftId);
            this.communityNotice(input.id, user.id, input.draftId);
          }
          return null;
        }
        case "sendQuote": {
          this.membership(user.id, input.id, true);
          const chapter = this.chapter(input.selection.book, input.selection.chapter, input.selection.version);
          if (!chapter) throw new LocalError("Capítulo não encontrado.", 404);
          const quote = JSON.stringify(bibleQuote(chapter, input.selection));
          const previous = this.get<{ userId: string; communityId: string; content: string; quote: string }>("SELECT userId,communityId,content,quote FROM messages WHERE id=?", input.requestId);
          if (previous) {
            if (previous.userId !== user.id || previous.communityId !== input.id || previous.content !== input.comment || previous.quote !== quote) throw new LocalError("Este envio já foi utilizado para outra mensagem.", 409);
            return input.requestId;
          }
          this.run("INSERT INTO messages(id,communityId,userId,content,sentAt,quote) VALUES (?,?,?,?,?,?)", input.requestId, input.id, user.id, input.comment, this.now(), quote);
          this.communityNotice(input.id, user.id, input.requestId); return input.requestId;
        }
        case "readNotification": {
          const notice = this.get<{ communityId: string | null; readAt: number | null }>("SELECT communityId,readAt FROM notifications WHERE id=? AND userId=?", input.id, user.id);
          if (!notice) throw new LocalError("Notificação não encontrada.", 404);
          if (notice.communityId) this.membership(user.id, notice.communityId);
          if (notice.readAt === null) { this.run("UPDATE notifications SET readAt=? WHERE id=? AND userId=?", this.now(), input.id, user.id); this.notificationsChanged(user.id); }
          return this.notificationSummary(user.id);
        }
        case "updateScripture": this.membership(user.id, input.id, true); this.run("UPDATE communities SET scripture=? WHERE id=?", input.scripture, input.id); return null;
        case "createChecklist": {
          this.membership(user.id, input.id, true);
          const id = randomUUID(); this.run("INSERT INTO checklists VALUES (?,?,?)", id, input.id, input.input.name);
          input.input.items.forEach((text, index) => this.run("INSERT INTO items VALUES (?,?,?,?)", randomUUID(), id, text, index)); return null;
        }
        case "setTick": {
          const item = this.get<{ communityId: string }>("SELECT l.communityId FROM items i JOIN checklists l ON l.id=i.listId WHERE i.id=?", input.itemId);
          if (!item) throw new LocalError("Item não encontrado.", 404);
          this.membership(user.id, item.communityId);
          if (input.checked) this.run("INSERT OR IGNORE INTO ticks VALUES (?,?)", input.itemId, user.id);
          else this.run("DELETE FROM ticks WHERE itemId=? AND userId=?", input.itemId, user.id);
          return null;
        }
        case "removeMember": {
          this.membership(user.id, input.id, true);
          const member = this.get<Member>("SELECT * FROM members WHERE id=? AND communityId=?", input.memberId, input.id);
          if (!member) return null;
          const count = this.get<{ count: number }>("SELECT COUNT(*) count FROM members WHERE communityId=? AND role='admin'", input.id)!.count;
          if (!canRemoveMember(member.role, count)) throw new LocalError("A comunidade precisa manter ao menos um administrador.");
          this.run("DELETE FROM members WHERE id=?", member.id); this.notificationsChanged(member.userId); return null;
        }
        case "setFavorite": {
          if (!input.saved) {
            const row = this.get<{ data: string }>("SELECT data FROM favorites WHERE userId=? AND date=?", user.id, input.date);
            this.run("DELETE FROM favorites WHERE userId=? AND date=?", user.id, input.date);
            this.removedFavorites.delete(user.id);
            if (!row) return null;
            const token = randomUUID();
            this.removedFavorites.set(user.id, { token, favorite: JSON.parse(row.data) as Favorite });
            return token;
          }
          const devotional = this.published(input.date, input.timeZone);
          if (!devotional) throw new LocalError("Este devocional não está disponível para favoritar.", 404);
          this.run("INSERT OR IGNORE INTO favorites VALUES (?,?,?)", user.id, input.date, JSON.stringify({ devotional, favoritedAt: this.now() } satisfies Favorite)); this.removedFavorites.delete(user.id); return null;
        }
        case "restoreFavorite": {
          const removed = this.removedFavorites.get(user.id);
          if (!removed || removed.token !== input.token) throw new LocalError("Não foi possível desfazer esta remoção. Volte à leitura para favoritar novamente.", 409);
          this.run("INSERT OR IGNORE INTO favorites VALUES (?,?,?)", user.id, removed.favorite.devotional.date, JSON.stringify(removed.favorite));
          this.removedFavorites.delete(user.id);
          return null;
        }
        case "schedule": {
          this.editor(user);
          const { mode, date, reason, ...content } = scheduleSchema.parse(input.input);
          const existing = this.get<PublicationRow>("SELECT data,publishedAt,withdrawn FROM devotionals WHERE date=?", date);
          if (mode === "create" && existing) throw new LocalError("Esta data já possui um devocional. Use Editar existente ou escolha uma data livre.", 409);
          if (mode === "update" && !existing) throw new LocalError("O devocional para editar não foi encontrado.", 404);
          if (mode === "create" && !canScheduleDate(date, this.now())) throw new LocalError("Escolha hoje ou uma data futura.");
          const name = this.profile(user.id).name;
          const previous = existing ? JSON.parse(existing.data) as Devotional & { publishedBy?: string } : null;
          content.selection ??= previous?.selection;
          if (content.selection) {
            const chapter = this.chapter(content.selection.book, content.selection.chapter, content.selection.version);
            if (!chapter) throw new LocalError("Capítulo não encontrado.", 404);
            const quote = bibleQuote(chapter, content.selection);
            content.scripture = quote.text; content.reference = quote.reference;
            scheduleSchema.parse({ ...content, mode, date, reason });
          } else if (previous) {
            // Legacy entries keep their original Word until a new Bible selection replaces it.
            content.scripture = previous.scripture; content.reference = previous.reference;
          }
          const data = JSON.stringify({ ...previous, ...content, date, id: date, translation: content.selection ? bibleVersionNames[content.selection.version] : previous?.translation ?? "AA · ABíbliaDigital", licenseEvidence: content.selection ? scriptureLicenseForVersion(content.selection.version) : previous?.licenseEvidence ?? content.licenseEvidence, credit: previous?.credit ?? name, reviewedBy: name, publishedBy: previous?.publishedBy ?? user.id });
          const publishedAt = publicationMidnight(date);
          if (mode === "create") this.run("INSERT INTO devotionals VALUES (?,?,?,0)", date, data, publishedAt);
          else this.run("UPDATE devotionals SET data=?,publishedAt=?,withdrawn=0 WHERE date=?", data, publishedAt, date);
          this.audit(user.id, mode === "create" ? "schedule" : "edit", date, mode === "create" ? "Publicação inicial" : reason!);
          return null;
        }
        case "publish": {
          this.editor(user);
          const { date, publishedAt, reason, ...content } = input.input;
          if (!this.get("SELECT date FROM devotionals WHERE date=?", date)) throw new LocalError("Use o cadastro para criar em uma data livre.", 404);
          this.run("UPDATE devotionals SET data=?,publishedAt=?,withdrawn=0 WHERE date=?", JSON.stringify({ ...content, date, id: date }), publishedAt, date);
          this.audit(user.id, "publish", date, reason); return null;
        }
        case "withdraw": {
          this.editor(user);
          const existing = this.get<PublicationRow>("SELECT withdrawn FROM devotionals WHERE date=?", input.date);
          if (!existing) throw new LocalError("Devocional não encontrado.", 404);
          if (!existing.withdrawn) { this.run("UPDATE devotionals SET withdrawn=1 WHERE date=?", input.date); this.audit(user.id, "withdraw", input.date, input.reason); }
          return null;
        }
      }
    });
  }
  private audit(userId: string, action: string, date: string, reason: string) { this.run("INSERT INTO audit VALUES (?,?,?,?,?,?)", randomUUID(), userId, action, date, reason, this.now()); }
  private detail(userId: string, id: string, cursor: string | null): CommunityDetail {
    const association = this.membership(userId, id);
    const group = this.get<Omit<Community, "role">>("SELECT * FROM communities WHERE id=?", id)!;
    const messages = this.all<{ seq: number; id: string; content: string; name: string; sentAt: number; quote: string | null }>("SELECT m.seq,m.id,m.content,m.quote,json_extract(u.data,'$.name') name,m.sentAt FROM messages m JOIN users u ON u.id=m.userId WHERE communityId=? AND seq<? ORDER BY seq DESC LIMIT 51", id, cursor ? Number(cursor) : Number.MAX_SAFE_INTEGER);
    const hasMore = messages.length > 50, page = messages.slice(0, 50);
    return {
      community: { ...group, role: association.role, inviteCode: canManage(association.role) ? group.inviteCode : undefined },
      members: this.all<Member>("SELECT m.id,m.userId,m.role,json_extract(u.data,'$.name') name FROM members m JOIN users u ON u.id=m.userId WHERE m.communityId=? ORDER BY m.role,u.id", id),
      messages: page.map(({ seq: _seq, quote, ...m }) => ({ ...m, quote: quote ? JSON.parse(quote) : undefined })).reverse(), hasMore, nextCursor: hasMore ? String(page.at(-1)!.seq) : null,
      lists: this.all<{ id: string; name: string }>("SELECT id,name FROM checklists WHERE communityId=? ORDER BY rowid", id).map(list => ({ ...list, items: this.all<{ id: string; text: string }>("SELECT id,text FROM items WHERE listId=? ORDER BY position", list.id).map(item => ({ ...item, checked: !!this.get("SELECT 1 FROM ticks WHERE itemId=? AND userId=?", item.id, userId), count: this.get<{ count: number }>("SELECT COUNT(*) count FROM ticks t JOIN members m ON m.userId=t.userId AND m.communityId=? WHERE t.itemId=?", id, item.id)!.count })) })),
    };
  }
  catalog(): BibleCatalog {
    return { version: "aa", books: this.all<{ data: string }>("SELECT data FROM bibleBooks ORDER BY bookOrder").map(r => JSON.parse(r.data) as BibleBook), verses: this.get<{ count: number }>("SELECT COUNT(*) count FROM bibleVerses")!.count, importedAt: Number(this.get<{ value: string }>("SELECT value FROM metadata WHERE key='bibleImportedAt'")?.value) || null, source: this.get<{ value: string }>("SELECT value FROM metadata WHERE key='bibleSource'")?.value ?? "" };
  }
  chapter(abbrev: string, chapter: number, version: BibleVersion = "aa"): BibleChapter | null {
    if (version === "alm1911") return alm1911Chapter(abbrev, chapter);
    const row = this.get<{ data: string }>("SELECT data FROM bibleBooks WHERE abbrev=?", abbrev);
    if (!row) return null;
    const book = JSON.parse(row.data) as BibleBook;
    if (chapter > book.chapters) return null;
    return { book, chapter, verses: this.all<{ number: number; text: string }>("SELECT number,text FROM bibleVerses WHERE abbrev=? AND chapter=? ORDER BY number", abbrev, chapter).map(v => ({ ...v, abbrev, bookName: book.name, chapter })) };
  }
  private search(query: string, page: number): BibleResults {
    const words = searchWords(query);
    if (!words.length) return { verses: [], total: 0, page };
    const match = words.map(w => '"' + w + '"*').join(" AND ");
    const total = this.get<{ count: number }>("SELECT COUNT(*) count FROM bibleSearch WHERE bibleSearch MATCH ?", match)!.count;
    const verses = this.all<BibleResults["verses"][number]>("SELECT v.abbrev,json_extract(b.data,'$.name') bookName,v.chapter,v.number,v.text FROM bibleSearch s JOIN bibleVerses v ON v.id=s.rowid JOIN bibleBooks b ON b.abbrev=v.abbrev WHERE bibleSearch MATCH ? ORDER BY b.bookOrder,v.chapter,v.number LIMIT 40 OFFSET ?", match, page * 40);
    return { verses, total, page };
  }
}
