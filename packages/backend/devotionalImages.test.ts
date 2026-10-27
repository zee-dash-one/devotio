import type { Id } from "./server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import workpool from "@convex-dev/workpool/test";
import { imageRevision } from "domain/core";
import schema from "./schema";
const modules = { "./_generated/server.ts": () => import("./server"), "./devotionalImages.ts": () => import("./devotionalImages"), "./editorial.ts": () => import("./editorial"), "./imageActions.ts": () => import("./imageActions") };
const ref = (name: string) => makeFunctionReference<"mutation">("devotionalImages:"+name);
const publish = makeFunctionReference<"mutation">("editorial:publish"), get = makeFunctionReference<"query">("devotionalImages:get");
const input = { date: "2026-10-25", reference: "João 1:1", translation: "ARC1911", scripture: "Texto", reflection: "Reflexão com esperança.", prayerSuggestion: "Senhor, guia-nos. Amém.", credit: "Equipe", licenseEvidence: "Autorizada", reviewedBy: "Editor", publishedAt: Date.parse("2026-10-25T03:00:00Z"), reason: "Teste" };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-25T15:00:00Z")); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
async function setup() {
  const t = convexTest(schema, modules); workpool.register(t, "imageWorkpool");
  await t.run(ctx => ctx.db.insert("users", { authId: "reader", name: "Leitor", email: "reader@example.com", status: "approved" }));
  return { t, reader: t.withIdentity({ subject: "reader" }) };
}
it("deduplicates unchanged saves, generates files once and keeps future URLs private", async () => {
  const { t, reader } = await setup();
  const id = await t.mutation(publish, input) as Id<"devotionals">;
  await t.mutation(publish, input);
  expect(await t.run(ctx => ctx.db.query("devotionalImageSets").collect())).toHaveLength(1);
  const before = await t.run(ctx => ctx.db.query("devotionalImageSets").first());
  expect(before?.generation).toBe(1);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const manifest = await reader.query(get, { id, revision: imageRevision(input) });
  expect(manifest.status).toBe("ready"); expect(manifest.files).toHaveLength(6);
  await t.mutation(publish, input);
  expect((await reader.query(get, { id, revision: imageRevision(input) })).files).toEqual(manifest.files);
  await t.run(ctx => ctx.db.patch(id, { publishedAt: Date.now()+60000 }));
  expect((await reader.query(get, { id, revision: imageRevision(input) })).files).toEqual([]);
  await expect(t.query(get, { id, revision: imageRevision(input) })).rejects.toThrow();
  await expect(reader.mutation(ref("retry"), { id })).rejects.toThrow("editorial");
});
it("refuses stale attempts after editing and deletes files on withdrawal", async () => {
  const { t, reader } = await setup();
  const id = await t.mutation(publish, input) as Id<"devotionals">;
  const old = (await t.run(ctx => ctx.db.query("devotionalImageSets").first()))!;
  const claim = await t.mutation(ref("claim"), { id: old._id, generation: old.generation });
  const storageId = await t.run(ctx => ctx.storage.store(new Blob(["png"], { type: "image/png" })));
  const uploadId = await t.mutation(ref("prepareUpload"), { id: old._id, generation: old.generation, run: claim.run, sha256: "test" });
  await t.mutation(publish, { ...input, reflection: "Correção editorial." });
  const accepted = await t.mutation(ref("registerFile"), { id: old._id, generation: old.generation, run: claim.run, uploadId, file: { variant: "story-paper", page: 1, pages: 1, width: 1080, height: 1920, bytes: 3, storageId } });
  expect(accepted).toBe(false);
  expect(await t.run(ctx => ctx.storage.get(storageId))).toBeNull();
  expect((await reader.query(get, { id, revision: old.revision })).status).toBe("unavailable");
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const ready = await reader.query(get, { id, revision: imageRevision({ ...input, reflection: "Correção editorial." }) });
  expect(ready.status).toBe("ready");
  const set = await t.run(async ctx => { const doc = await ctx.db.get(id); return ctx.db.get(doc!.imageSetId!); });
  await t.mutation(makeFunctionReference<"mutation">("editorial:withdraw"), { id, actor: "Editor", reason: "Revisão" });
  expect((await reader.query(get, { id, revision: set!.revision })).files).toEqual([]);
  for (const file of set!.files) expect(await t.run(ctx => ctx.storage.get(file.storageId))).toBeNull();
});
it("rejects incomplete publication and isolates old completion callbacks", async () => {
  const { t } = await setup(); await t.mutation(publish, input);
  const set = (await t.run(ctx => ctx.db.query("devotionalImageSets").first()))!;
  const claim = await t.mutation(ref("claim"), { id: set._id, generation: set.generation });
  await expect(t.mutation(ref("finish"), { id: set._id, generation: set.generation, run: claim.run })).rejects.toThrow("incompleto");
  await t.mutation(ref("completed"), { workId: set.workId, context: { id: set._id, generation: set.generation-1 }, result: { kind: "failed", error: "old" } });
  expect((await t.run(ctx => ctx.db.get(set._id)))?.status).toBe("rendering");
});

it("retries a failed action three times and permits an explicit editorial retry", async () => {
  const { t, reader } = await setup();
  const id = await t.mutation(publish, { ...input, reflection: "Texto 😀" });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const set = (await t.run(ctx => ctx.db.query("devotionalImageSets").first()))!;
  expect(set.status).toBe("failed"); expect(set.attempts).toBe(3);
  await t.run(async ctx => { const user = await ctx.db.query("users").first(); await ctx.db.patch(user!._id, { editorial: true }); });
  await reader.mutation(ref("retry"), { id });
  const retried = (await t.run(ctx => ctx.db.get(set._id)))!;
  expect(retried.status).toBe("pending"); expect(retried.generation).toBe(2);
});
it("cleans interrupted image uploads without deleting unrelated storage", async () => {
  const { t } = await setup();
  const [orphan, unrelated] = await t.run(async ctx => {
    const { reason: _reason, ...publication } = input;
    const docId = await ctx.db.insert("devotionals", { ...publication, withdrawn: false, updatedAt: Date.now() });
    const setId = await ctx.db.insert("devotionalImageSets", { devotionalId: docId, revision: imageRevision(input), content: { date: input.date, reference: input.reference, reflection: input.reflection, prayerSuggestion: input.prayerSuggestion }, generation: 1, status: "rendering", attempts: 1, updatedAt: Date.now(), expiresAt: Date.now()+86400000, files: [] });
    const orphan = await ctx.storage.store(new Blob(["orphan"], { type: "image/png" }));
    const meta = (await ctx.db.system.get(orphan))!;
    await ctx.db.insert("devotionalImageUploads", { setId, sha256: meta.sha256, expiresAt: Date.now()+86400000 });
    const unrelated = await ctx.storage.store(new Blob(["other feature"])); return [orphan, unrelated];
  });
  vi.setSystemTime(Date.now()+3600001);
  await t.mutation(ref("cleanupOrphans"), { cursor: null });
  expect(await t.run(ctx => ctx.storage.get(orphan))).toBeNull();
  expect(await t.run(async ctx => (await ctx.storage.get(unrelated)) !== null)).toBe(true);
});
