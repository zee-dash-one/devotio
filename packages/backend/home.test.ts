import { expect, it } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "./schema";
const modules = { "./_generated/server.ts": () => import("./server"), "./home.ts": () => import("./home") };
it("returns the stored selection, preserves legacy absence and enforces access", async () => {
  const t = convexTest(schema, modules), get = makeFunctionReference<"query">("home:get");
  const selection = { book: "cl", chapter: 1, first: 3, last: 23, version: "alm1911" as const };
  const id = await t.run(async ctx => {
    await ctx.db.insert("users", { authId: "reader", name: "Leitor", email: "reader@example.com", status: "approved" });
    return ctx.db.insert("devotionals", { date: "2026-10-25", reference: "Colossenses 1:3–23", translation: "ARC1911", scripture: "Texto", reflection: "Meditar", prayerSuggestion: "Orar", credit: "Equipe", licenseEvidence: "Autorizada", reviewedBy: "Editor", publishedAt: 0, withdrawn: false, updatedAt: 0, selection });
  });
  const reader = t.withIdentity({ subject: "reader" });
  expect((await reader.query(get, { date: "2026-10-25" })).devotional.selection).toEqual(selection);
  await t.run(ctx => ctx.db.patch(id, { selection: undefined }));
  expect((await reader.query(get, { date: "2026-10-25" })).devotional.selection).toBeUndefined();
  await expect(t.query(get, { date: "2026-10-25" })).rejects.toThrow();
  await t.run(async ctx => { const user = await ctx.db.query("users").first(); await ctx.db.patch(user!._id, { status: "disabled" }); });
  await expect(reader.query(get, { date: "2026-10-25" })).rejects.toThrow();
});
