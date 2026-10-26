import { afterEach, expect, it } from "vitest";
import { existsSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { tmpdir } from "node:os";
import { LocalDatabase } from "./database.local";
import { LocalImages } from "./images.local";
import { imageRevision, type Devotional } from "domain/core";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const fn of cleanup.splice(0)) await fn(); });
it("stores PNG files once, survives reopening, hides future/snapshot revisions and withdraws", async () => {
  const db = new LocalDatabase(":memory:", undefined, () => Date.parse("2026-10-25T15:00:00Z"));
  const images = new LocalImages(db);
  cleanup.push(async () => {
    images.close(); await images.idle(); db.close();
    if (dirname(resolve(images.directory)) !== resolve(tmpdir()) || !basename(images.directory).startsWith("devotio-images-")) throw new Error("Unexpected temporary directory");
    if (existsSync(images.directory)) { for (const name of readdirSync(images.directory)) unlinkSync(join(images.directory,name)); rmdirSync(images.directory); }
  });
  const date = "2026-10-25", day = JSON.parse(db.get<{ data: string }>("SELECT data FROM devotionals WHERE date=?", date)!.data) as Devotional;
  images.refresh(date); images.refresh(date); await images.idle();
  const first = images.manifest(date,imageRevision(day));
  expect(first.status).toBe("ready"); expect(first.files.length).toBeGreaterThanOrEqual(6);
  images.refresh(date); await images.idle(); expect(images.manifest(date,imageRevision(day))).toEqual(first);
  expect(db.all("SELECT * FROM devotionalImageSets")).toHaveLength(1);
  expect(images.file(date, first.revision, first.files[0].variant, 1)?.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(images.manifest(date,imageRevision({ ...day, reflection: "Snapshot antigo" })).status).toBe("unavailable");
  db.run("UPDATE devotionals SET publishedAt=? WHERE date=?", db.now()+60000, date);
  expect(images.manifest(date,first.revision).files).toEqual([]);
  db.run("UPDATE devotionals SET withdrawn=1 WHERE date=?", date); images.refresh(date);
  expect(images.manifest(date,first.revision).status).toBe("unavailable");
  expect(readdirSync(images.directory)).toHaveLength(0);
});
