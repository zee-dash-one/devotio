import { describe, expect, it } from "vitest";
import { bibleQuote, bibleQuotePath, quoteText, selectionRange, bibleSelectionSchema, notificationDate, selectionVerses, toggleVerse, verseGroups } from "./sharing";
import { localCommandSchema, localQuerySchema } from "./validators/local";
const chapter = { book: { abbrev: "jo", name: "João", chapters: 21, testament: "NT" as const, order: 43 }, chapter: 1, verses: [1, 2, 3].map(number => ({ abbrev: "jo", bookName: "João", chapter: 1, number, text: `Verso ${number}` })) };
const selection = { book: "jo", chapter: 1, first: 1, last: 3, version: "aa" as const };
describe("seleção e compartilhamento", () => {
  it("alterna versos, agrupa referências e lê intervalos legados", () => {
    expect(selectionVerses(selection)).toEqual([1, 2, 3]);
    let state = toggleVerse(null, selection, 1);
    for (const n of [2, 5, 6]) state = toggleVerse(state, selection, n);
    expect(state?.verses).toEqual([1, 2, 5, 6]);
    expect(verseGroups(state!.verses!)).toBe("1–2, 5–6");
    expect(toggleVerse(state, selection, 5)?.verses).toEqual([1, 2, 6]);
    expect(toggleVerse(state, { ...selection, chapter: 2 }, 3)?.verses).toEqual([3]);
    expect(toggleVerse(toggleVerse(null, selection, 1), selection, 1)).toBeNull();
  });
  it("preserva somente os versos escolhidos e rejeita listas inconsistentes", () => {
    const chosen = { ...selection, verses: [1, 3] };
    expect(bibleSelectionSchema.parse(chosen)).toEqual(chosen);
    expect(bibleQuote(chapter, chosen).text).toBe("1 - Verso 1\n3 - Verso 3");
    expect(bibleQuote(chapter, chosen).reference).toBe("João 1:1, 3");
    for (const verses of [[], [3, 1], [1, 1, 3], [1, 4], [2], [1.5, 3]]) {
      expect(bibleSelectionSchema.safeParse({ ...selection, verses }).success).toBe(false);
    }
  });
  it("normaliza arraste invertido e constrói trecho completo, referência, versão e primeiro verso", () => {
    expect(selectionRange(3, 1)).toEqual({ first: 1, last: 3 });
    const quote = bibleQuote(chapter, selection);
    expect(quote.text).toBe("1 - Verso 1\n2 - Verso 2\n3 - Verso 3");
    expect(quote.reference).toBe("João 1:1–3");
    expect(quoteText(quote)).toBe("1 - Verso 1\n2 - Verso 2\n3 - Verso 3\n\nJoão 1:1–3\nAlmeida Atualizada (AA)");
    expect(bibleQuotePath(quote)).toBe("/biblia?book=jo&chapter=1&verse=1&version=aa");
    expect(bibleQuote(chapter, { ...selection, first: 2, last: 2 }).reference).toBe("João 1:2");
  });
  it("rejeita lacunas, capítulo errado, outra versão e intervalos inválidos", () => {
    expect(() => bibleQuote({ ...chapter, verses: chapter.verses.filter(verse => verse.number !== 2) }, selection)).toThrow("Versículos");
    expect(() => bibleQuote(chapter, { ...selection, chapter: 2 })).toThrow("outro capítulo");
    expect(bibleSelectionSchema.safeParse({ ...selection, first: 3, last: 1 }).success).toBe(false);
    expect(bibleSelectionSchema.safeParse({ ...selection, version: "nvi" }).success).toBe(false);
  });
  it("comentário é opcional, separado do trecho; busca começa após três caracteres", () => {
    const command = { action: "sendQuote", id: "esperanca", selection, comment: "", requestId: "3537e982-5116-45df-95d9-c2c9f7f1cbbf" };
    expect(localCommandSchema.safeParse(command).success).toBe(true);
    expect(localCommandSchema.safeParse({ ...command, comment: "a".repeat(1001) }).success).toBe(false);
    expect(localQuerySchema.safeParse({ query: "search", text: "amo", page: 0 }).success).toBe(false);
    expect(localQuerySchema.safeParse({ query: "search", text: "amor", page: 0 }).success).toBe(true);
    expect(notificationDate(Date.parse("2026-10-08T02:59:00Z"))).toBe("07/10/2026");
  });
});
