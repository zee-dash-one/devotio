import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { dateInZone, favoriteLimitMessage, MAX_FAVORITE_DEVOTIONALS, type ReadingData } from "domain/core";
import schema from "./convex/schema";

const modules = {
  "./convex/_generated/server.ts": () => import("./convex/_generated/server"),
  "./convex/reading.ts": () => import("./convex/reading"),
};
const get = makeFunctionReference<"query", { today: string }, ReadingData>("reading:get");
const setFavorite = makeFunctionReference<"mutation", { date: string; saved: boolean }, string | null>("reading:setFavorite");
const restoreFavorite = makeFunctionReference<"mutation", { token: string }, null>("reading:restoreFavorite");
const today = dateInZone("America/Sao_Paulo");
const day = (offset: number) => new Date(Date.parse(today + "T12:00:00Z") - offset * 86400000).toISOString().slice(0, 10);

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const ana = await ctx.db.insert("users", { name: "Ana", email: "ana@example.com", authId: "Ana", status: "approved" });
    await ctx.db.insert("users", { name: "Bruno", email: "bruno@example.com", authId: "Bruno", status: "approved" });
    for (let offset = 0; offset < 12; offset++) {
      if (offset === 2) continue;
      await ctx.db.insert("devotionals", {
        date: day(offset), reference: `Salmos ${offset + 1}:1`, translation: "AA", scripture: `Palavra ${offset}`,
        reflection: `Meditação ${offset}`, prayerSuggestion: "Oração", credit: "Editor",
        licenseEvidence: "Fixture", reviewedBy: "Editor", publishedAt: Date.now() - 1000,
        withdrawn: offset === 1, updatedAt: Date.now() - 1000,
      });
    }
    return { ana };
  });
  return { t, ids, ana: t.withIdentity({ subject: "Ana" }), bruno: t.withIdentity({ subject: "Bruno" }) };
}

describe("Convex devotional reading and private favorites", () => {
  it("returns seven published readings, skipping gaps and withdrawals", async () => {
    const { ana } = await setup();
    const data = await ana.query(get, { today });
    expect(data.dates).toEqual([0, 3, 4, 5, 6, 7, 8].map(day));
    expect(data.recent.map(item => item.scripture)).toEqual([0, 3, 4, 5, 6, 7, 8].map(offset => `Palavra ${offset}`));
  });

  it("enforces the central limit and isolates snapshots and one-use restoration", async () => {
    const { t, ana, bruno } = await setup();
    for (const offset of [0, 3, 4]) await ana.mutation(setFavorite, { date: day(offset), saved: true });
    await ana.mutation(setFavorite, { date: day(0), saved: true });
    expect((await ana.query(get, { today })).favorites).toHaveLength(MAX_FAVORITE_DEVOTIONALS);
    expect((await bruno.query(get, { today })).favorites).toHaveLength(0);
    await expect(ana.mutation(setFavorite, { date: day(5), saved: true })).rejects.toThrow(favoriteLimitMessage());
    const token = await ana.mutation(setFavorite, { date: day(0), saved: false });
    expect(token).toBeTruthy();
    await expect(bruno.mutation(restoreFavorite, { token: token! })).rejects.toThrow();
    await ana.mutation(restoreFavorite, { token: token! });
    await expect(ana.mutation(restoreFavorite, { token: token! })).rejects.toThrow();
    await t.run(async ctx => {
      const doc = await ctx.db.query("devotionals").withIndex("by_date", q => q.eq("date", day(0))).unique();
      if (doc) await ctx.db.patch(doc._id, { scripture: "Corrigida", withdrawn: true });
    });
    expect((await ana.query(get, { today })).favorites.find(item => item.devotional.date === day(0))?.devotional.scripture).toBe("Palavra 0");
  });
});
