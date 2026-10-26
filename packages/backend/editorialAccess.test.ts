import workpool from "@convex-dev/workpool/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "./schema";
const modules = { "./imageActions.ts": () => import("./imageActions"), "./devotionalImages.ts": () => import("./devotionalImages"), "./_generated/server.ts": () => import("./_generated/server"), "./editorial.ts": () => import("./editorial"), "./editorialAccess.ts": () => import("./editorialAccess") };
const save = makeFunctionReference<"mutation">("editorialAccess:save"), get = makeFunctionReference<"query">("editorialAccess:get"), calendar = makeFunctionReference<"query">("editorialAccess:calendar");
const draft = { date: "2026-10-09", reflection: "Reflexão", prayerSuggestion: "Oração", mode: "create" as const,
  selection: { book: "jo", chapter: 1, first: 1, last: 1, version: "alm1911" as const } };
beforeEach(() => { vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-09T15:00:00Z")); });
afterEach(() => vi.restoreAllMocks());
async function setup(editorial = true, status: "approved" | "pending" | "disabled" = "approved") {
  const t = convexTest(schema, modules); workpool.register(t, "imageWorkpool");
  const id = await t.run(ctx => ctx.db.insert("users", { authId: "editor", name: "Editor real", email: "editor@example.com", status, editorial }));
  return { t, id, user: t.withIdentity({ subject: "editor" }) };
}
describe("editorial conectado com fonte confiável", () => {
  it("deriva escritura, edição, autor, horário e motivo; rejeita duplicidade e campos forjados", async () => {
    const { user, t, id } = await setup();
    await user.mutation(save, draft);
    const value = await user.query(get, { date: draft.date });
    expect(value).toMatchObject({ credit: "Editor real", scripture: "1 - No principio era o Verbo, e o Verbo estava com Deus, e o Verbo era Deus.", reference: "João 1:1", translation: "Almeida Revista e Corrigida 1911 (ARC1911)", publishedAt: Date.parse("2026-10-09T03:00:00Z"), selection: draft.selection });
    const events = await t.run(ctx => ctx.db.query("editorialEvents").collect());
    expect(events[0]).toMatchObject({ actor: id, reason: "Publicação inicial" });
    await expect(user.mutation(save, draft)).rejects.toThrow("já possui");
    await expect(user.mutation(save, { ...draft, credit: "Forjado" })).rejects.toThrow();
  });
  it("bloqueia passado, excesso de caracteres, seleção ausente/ inválida e versão indisponível", async () => {
    const { user } = await setup();
    await expect(user.mutation(save, { ...draft, date: "2026-10-08" })).rejects.toThrow("futura");
    for (const key of ["reflection", "prayerSuggestion"]) await expect(user.mutation(save, { ...draft, [key]: "A".repeat(513) })).rejects.toThrow("512");
    await expect(user.mutation(save, { ...draft, selection: undefined })).rejects.toThrow("trecho");
    await expect(user.mutation(save, { ...draft, selection: { ...draft.selection, first: 52, last: 52 } })).rejects.toThrow("Versículos");
    await expect(user.mutation(save, { ...draft, selection: { ...draft.selection, version: "aa" } })).rejects.toThrow("tradução");
  });
  it("calendário exclui ocupadas e retiradas e correção preserva crédito/legado", async () => {
    const { user, t } = await setup();
    await user.mutation(save, draft);
    const value = await user.query(get, { date: draft.date });
    await user.mutation(makeFunctionReference<"mutation">("editorialAccess:withdraw"), { id: value.id, reason: "Revisar" });
    const free = await user.query(calendar, { month: "2026-10", today: "2026-10-09" });
    expect(free.dates).not.toContain(draft.date); expect(free.dates[0]).toBe("2026-10-10");
    await t.run(ctx => ctx.db.patch(value.id, { credit: "Autor original", reflection: "A".repeat(700) }));
    expect((await user.query(get, { date: draft.date })).reflection).toHaveLength(700);
    await expect(user.mutation(save, { ...draft, mode: "update", selection: undefined })).rejects.toThrow("motivo");
    await user.mutation(save, { ...draft, mode: "update", selection: undefined, reason: "Adequar reflexão" });
    expect(await user.query(get, { date: draft.date })).toMatchObject({ credit: "Autor original", withdrawn: false, reflection: draft.reflection });
  });
  it.each([[false, "approved"], [true, "pending"], [true, "disabled"]] as const)("nega leitura e gravação sem capacidade (%s / %s)", async (editorial, status) => {
    const { user } = await setup(editorial, status);
    await expect(user.query(calendar, { month: "2026-10", today: "2026-10-09" })).rejects.toThrow();
    await expect(user.query(get, { date: draft.date })).rejects.toThrow();
    await expect(user.mutation(save, draft)).rejects.toThrow();
  });
});
