import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, unlinkSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { imageContent, imageRevision, imageAvailableToday, isPublished, IMAGE_RETENTION_DAYS, type Devotional, type DevotionalImageManifest } from "../../domain/index";
import { renderImages } from "../rendering/images.node";
import { LocalDatabase } from "./database.local";
type Row = { date: string; data: string; publishedAt: number; withdrawn: number };
type Stored = { revision: string; date: string; manifest: string; expiresAt: number };
export class LocalImages {
  readonly directory: string;
  private closed = false;
  private queue = Promise.resolve();
  private pending = new Set<string>();
  private listeners = new Set<() => void>();
  constructor(private db: LocalDatabase) {
    this.directory = db.path === ":memory:" ? join(tmpdir(), "devotio-images-" + randomUUID()) : join(dirname(db.path), "devotional-images");
    db.db.exec("CREATE TABLE IF NOT EXISTS devotionalImageSets (revision TEXT PRIMARY KEY, date TEXT NOT NULL, manifest TEXT NOT NULL, expiresAt INTEGER NOT NULL)");
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit() { for (const listener of this.listeners) listener(); }
  close() { this.closed = true; this.listeners.clear(); }
  async idle() { await this.queue; }
  private row(date: string) { return this.db.get<Row>("SELECT * FROM devotionals WHERE date=?", date); }
  private remove(set: Stored) {
    const manifest = JSON.parse(set.manifest) as DevotionalImageManifest;
    for (const file of manifest.files) { const path = join(this.directory, set.revision + "-" + file.variant + "-" + file.page + ".png"); if (existsSync(path)) unlinkSync(path); }
    this.db.run("DELETE FROM devotionalImageSets WHERE revision=?", set.revision);
  }
  start() {
    for (const set of this.db.all<Stored>("SELECT * FROM devotionalImageSets WHERE expiresAt<=?", this.db.now())) this.remove(set);
    if (existsSync(this.directory)) {
      const retained = new Set(this.db.all<Stored>("SELECT * FROM devotionalImageSets").flatMap(set => (JSON.parse(set.manifest) as DevotionalImageManifest).files.map(file => set.revision + "-" + file.variant + "-" + file.page + ".png")));
      for (const name of readdirSync(this.directory)) if (/^[a-f0-9]{64}-[a-z]+-[a-z]+-\d+\.png(?:\.tmp)?$/.test(name) && !retained.has(name)) unlinkSync(join(this.directory, name));
    }
    const since = new Date(this.db.now()-86400000).toISOString().slice(0,10);
    for (const row of this.db.all<Row>("SELECT * FROM devotionals WHERE date>=? ORDER BY date LIMIT 32", since)) this.refresh(row.date);
  }
  refresh(date: string, retry = false) {
    if (this.closed) return;
    const row = this.row(date), content = row && imageContent(JSON.parse(row.data) as Devotional), revision = content && imageRevision(content);
    for (const set of this.db.all<Stored>("SELECT * FROM devotionalImageSets WHERE date=?", date)) if (row?.withdrawn || set.revision !== revision) this.remove(set);
    this.emit();
    if (!row || row.withdrawn || !content || !revision || this.pending.has(revision)) return;
    const existing = this.db.get<Stored>("SELECT * FROM devotionalImageSets WHERE revision=?", revision);
    const previous = existing && JSON.parse(existing.manifest) as DevotionalImageManifest | undefined;
    if (previous?.status === "ready" || (previous?.status === "failed" && !retry)) return;
    const expiresAt = Date.parse(date + "T03:00:00Z") + IMAGE_RETENTION_DAYS * 86400000;
    if (expiresAt <= this.db.now()) return;
    const save = (manifest: DevotionalImageManifest) => this.db.run("INSERT OR REPLACE INTO devotionalImageSets VALUES (?,?,?,?)", revision, date, JSON.stringify(manifest), expiresAt);
    save({ revision, status: "pending", files: [] }); this.pending.add(revision);
    this.queue = this.queue.then(async () => {
      const current = () => { if (this.closed) return false; const value = this.row(date); return !!value && !value.withdrawn && imageRevision(JSON.parse(value.data) as Devotional) === revision; };
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!current()) break;
        const written: string[] = [];
        try {
          save({ revision, status: "rendering", files: [] }); this.emit(); mkdirSync(this.directory, { recursive: true });
          const files: DevotionalImageManifest["files"] = [];
          for await (const { png, ...file } of renderImages(content)) {
            if (!current()) break;
            const path = join(this.directory, revision + "-" + file.variant + "-" + file.page + ".png");
            writeFileSync(path + ".tmp", png); renameSync(path + ".tmp", path); written.push(path);
            files.push({ ...file, bytes: png.byteLength, url: "/__local/image-file?date=" + date + "&revision=" + revision + "&variant=" + file.variant + "&page=" + file.page });
          }
          if (!current()) { for (const path of written) if (existsSync(path)) unlinkSync(path); break; }
          save({ revision, status: "ready", files }); this.emit(); break;
        } catch {
          for (const path of written) if (existsSync(path)) unlinkSync(path);
          if (!current()) break;
          if (attempt === 2) { save({ revision, status: "failed", files: [] }); this.emit(); }
          else await new Promise(resolve => setTimeout(resolve, 1000 * (attempt+1)));
        }
      }
      this.pending.delete(revision);
    }).catch(() => { this.pending.delete(revision); });
  }
  manifest(id: string, revision: string): DevotionalImageManifest {
    const unavailable: DevotionalImageManifest = { revision, status: "unavailable", files: [] };
    const row = this.row(id);
    if (!row || !imageAvailableToday(row.date, this.db.now()) || !isPublished(row.publishedAt, !!row.withdrawn, this.db.now()) || imageRevision(JSON.parse(row.data) as Devotional) !== revision) return unavailable;
    const set = this.db.get<Stored>("SELECT * FROM devotionalImageSets WHERE revision=?", revision);
    return set && set.expiresAt > this.db.now() ? JSON.parse(set.manifest) as DevotionalImageManifest : unavailable;
  }
  file(date: string, revision: string, variant: string, page: number): Buffer | null {
    const manifest = this.manifest(date, revision);
    if (manifest.status !== "ready" || !manifest.files.some(file => file.variant === variant && file.page === page)) return null;
    const path = join(this.directory, revision + "-" + variant + "-" + page + ".png");
    return existsSync(path) ? readFileSync(path) : null;
  }
}
