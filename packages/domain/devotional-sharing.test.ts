import { expect, it } from "vitest";
import { devotionalShareText, devotionalSectionText, devotionalVerses, devotionalQuote } from "./devotional-sharing";
import { bibleParamsSchema } from "./validators/local";
const devotional = { id: "day", date: "2026-10-20", reference: "João 3:1–2, 5–6", translation: "Almeida Atualizada (AA)", scripture: "1 - Um\n2 - Dois\n5 - Cinco\n6 - Seis", reflection: "Meditação", prayerSuggestion: "Oração", credit: "Autor", selection: { book: "jo", chapter: 3, first: 1, last: 6, verses: [1, 2, 5, 6], version: "aa" as const } };
it("valida listas de URL e tolera links antigos ou malformados", () => {
  expect(bibleParamsSchema.parse({ verses: "1,2,5,6" }).verses).toBe("1,2,5,6");
  expect(bibleParamsSchema.parse({ verses: 1 }).verses).toBe("1");
  for (const verses of ["", "2,1", "1,1", "0", "177", "1,x", "1.5"]) expect(bibleParamsSchema.parse({ verses }).verses).toBeUndefined();
  expect(bibleParamsSchema.parse({ verse: 5 })).toMatchObject({ verse: 5 });
});
it("compartilha o dia da publicação, seções e URL pública", () => {
  expect(devotionalShareText(devotional, "https://example.com")).toBe("Devocional de 20/10/2026\n\nPALAVRA\nJoão 3:1–2, 5–6 — Almeida Atualizada (AA)\n\n1 - Um\n2 - Dois\n5 - Cinco\n6 - Seis\n\nMEDITAR\n\nMeditação\n\nORAÇÃO\n\nOração\n\nDevotio — https://example.com");
  expect(devotionalSectionText(devotional, "reflection")).toBe("Meditação\n\nJoão 3:1–2, 5–6");
  expect(devotionalSectionText(devotional, "prayerSuggestion")).toBe("Oração\n\nJoão 3:1–2, 5–6");
});
it("reutiliza o texto publicado e limita a seleção aos versos da Palavra", () => {
  expect(devotionalVerses(devotional).map(verse => verse.number)).toEqual([1, 2, 5, 6]);
  const selected = { ...devotional.selection, first: 2, last: 5, verses: [2, 5] };
  expect(devotionalQuote(devotional, selected)).toMatchObject({ text: "2 - Dois\n5 - Cinco", reference: "João 3:2, 5", verses: [2, 5] });
  expect(devotionalQuote(devotional, { ...selected, verses: [2, 3, 5] })).toBeNull();
  expect(devotionalVerses({ ...devotional, selection: undefined })).toEqual([]);
  expect(devotionalVerses({ ...devotional, scripture: "Texto antigo sem numeração" })).toEqual([]);
});
