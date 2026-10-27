import { describe, expect, it } from "vitest";
import { dateInZone, recentDates, isRecent, canPublish, searchWords, publicationMidnight, canScheduleDate, favoriteLimitMessage, MAX_FAVORITE_DEVOTIONALS } from "./reading";
import { scheduleSchema } from "./validators";
import { localCommandSchema, timeZoneSchema, bibleParamsSchema } from "./validators/local";
describe("leitura e acesso local", () => {
  it("centralizes the favorite limit and its user message", () => {
    expect(MAX_FAVORITE_DEVOTIONALS).toBe(3);
    expect(favoriteLimitMessage()).toContain("até 3 devocionais");
    expect(favoriteLimitMessage(5)).toContain("até 5 devocionais");
  });
  it("programa meia-noite de Brasília, inclusive virada de ano e ano bissexto", () => {
    expect(new Date(publicationMidnight("2026-10-08")).toISOString()).toBe("2026-10-08T03:00:00.000Z");
    expect(new Date(publicationMidnight("2027-01-01")).toISOString()).toBe("2027-01-01T03:00:00.000Z");
    expect(dateInZone("America/Sao_Paulo", new Date(publicationMidnight("2028-02-29")))).toBe("2028-02-29");
    expect(() => publicationMidnight("2026-02-30")).toThrow();
    expect(canScheduleDate("2026-10-04", Date.parse("2026-10-05T02:59:00Z"))).toBe(true);
    expect(canScheduleDate("2026-10-04", Date.parse("2026-10-05T03:00:00Z"))).toBe(false);
  });
  it("valida os campos do cadastro e rejeita conteúdo vazio ou excessivo", () => {
    const input = { mode: "create", date: "2026-10-08", reference: "João 1:1", scripture: "Palavra", reflection: "Meditação", prayerSuggestion: "Oração", licenseEvidence: "Fonte local", selection: { book: "jo", chapter: 1, first: 1, last: 1, version: "aa" } };
    expect(scheduleSchema.safeParse({ ...input, selection: undefined }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...input, mode: "update", selection: undefined }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...input, mode: "update", selection: undefined, reason: "Correção editorial" }).success).toBe(true);
    expect(scheduleSchema.safeParse(input).success).toBe(true);
    expect(scheduleSchema.safeParse({ ...input, scripture: "  " }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...input, prayerSuggestion: "a".repeat(2001) }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...input, mode: "replace" }).success).toBe(false);
  });
  it("oferece oito datas e respeita virada de mês/ano e ano bissexto", () => {
    expect(recentDates("2026-01-03")).toEqual(["2026-01-03", "2026-01-02", "2026-01-01", "2025-12-31", "2025-12-30", "2025-12-29", "2025-12-28", "2025-12-27"]);
    expect(recentDates("2024-03-01")[1]).toBe("2024-02-29");
    expect(isRecent("2026-09-27", "2026-10-04")).toBe(true);
    expect(isRecent("2026-09-26", "2026-10-04")).toBe(false);
    expect(isRecent("2026-10-05", "2026-10-04")).toBe(false);
  });
  it("calcula hoje pelo relógio e fuso válido, não por data enviada pelo client", () => {
    const now = new Date("2026-10-04T01:00:00Z");
    expect(dateInZone("America/Sao_Paulo", now)).toBe("2026-10-03");
    expect(dateInZone("Asia/Tokyo", now)).toBe("2026-10-04");
    expect(timeZoneSchema.safeParse("ontem").success).toBe(false);
  });
  it("AG não implica acesso editorial; busca não aceita operadores de consulta", () => {
    expect(canPublish(false)).toBe(false); expect(canPublish(undefined)).toBe(false); expect(canPublish(true)).toBe(true);
    expect(searchWords('"oração" OR amor*')).toEqual(["oracao", "or", "amor"]);
    expect(searchWords("***")).toEqual([]);
  });
  it("valida comandos e normaliza links inválidos sem habilitar outro conteúdo", () => {
    expect(localCommandSchema.safeParse({ action: "setTick", itemId: "x", checked: "true" }).success).toBe(false);
    expect(localCommandSchema.safeParse({ action: "setFavorite", date: "2026-02-30", saved: true, timeZone: "UTC" }).success).toBe(false);
    expect(bibleParamsSchema.parse({ book: "../admin", chapter: -1 })).toEqual({ book: "jo", chapter: 1 });
  });
});
