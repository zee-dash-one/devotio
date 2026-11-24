import { z } from "zod";

export const bibleVersionSchema = z.enum(["aa", "alm1911", "ara", "arc", "nvi"]);
export type BibleVersion = z.infer<typeof bibleVersionSchema>;
export const licensedBibleVersions = ["ara", "arc", "nvi"] as const;
export const bibleVersionNames: Record<BibleVersion, string> = {
  aa: "Almeida Atualizada (AA)",
  alm1911: "Almeida Revista e Corrigida 1911 (ARC1911)",
  ara: "Almeida Revista e Atualizada (ARA)",
  arc: "Almeida Revista e Corrigida (ARC)",
  nvi: "Nova Versão Internacional (NVI)",
};
export const bibleEditionPointerSchema = z.object({
  version: bibleVersionSchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  verses: z.number().int().positive(),
  books: z.literal(66),
});
export const alm1911Revision = "a47705dc5637daaa2e65160c9fe9aadb70edbdda855179045dbaf288f6aff795";
export const alm1911Base = `/bibles/alm1911/${alm1911Revision}`;
const canonicalBooks = "gn ex lv nm dt js jz rt 1sm 2sm 1rs 2rs 1cr 2cr ed ne et job sl pv ec ct is jr lm ez dn os jl am ob jn mq na hc sf ag zc ml mt mc lc jo at rm 1co 2co gl ef fp cl 1ts 2ts 1tm 2tm tt fm hb tg 1pe 2pe 1jo 2jo 3jo jd ap".split(" ");
// Canonical order and chapter counts prevent positional mapping of a shifted corpus.
const chapterCounts = [50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4,28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22];
export const alm1911DatasetSchema = z.array(z.object({
  abbrev: z.string().min(1), name: z.string().min(1),
  chapters: z.array(z.array(z.string().refine(t => t.trim().length > 0)).min(1)).min(1),
})).length(66).superRefine((books, ctx) => {
  books.forEach((book, i) => {
    const source = book.abbrev.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const expected = canonicalBooks[i] === "job" ? "jo" : canonicalBooks[i];
    if (source !== expected || book.chapters.length !== chapterCounts[i])
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i], message: "Ordem, livro ou capítulos divergentes da edição 1911." });
  });
}).transform(books => books.map((book, i) => ({
  ...book, abbrev: canonicalBooks[i],
  testament: i < 39 ? "VT" as const : "NT" as const, order: i + 1,
})));
export const bibleBookSchema = z.object({
  abbrev: z.string().regex(/^[a-z0-9]{1,6}$/), name: z.string().min(1),
  chapters: z.number().int().min(1).max(150), testament: z.enum(["VT", "NT"]), order: z.number().int().min(1).max(66),
});
export const bibleVerseSchema = z.object({
  abbrev: z.string(), bookName: z.string(), chapter: z.number().int().positive(),
  number: z.number().int().positive(), text: z.string().min(1),
});
export const bibleChapterSchema = z.object({
  version: bibleVersionSchema, book: bibleBookSchema, chapter: z.number().int().positive(),
  verses: z.array(bibleVerseSchema).min(1).max(176),
});
export const bibleCatalogSchema = z.object({
  version: bibleVersionSchema, books: z.array(bibleBookSchema).length(66),
  verses: z.number().int().positive(), importedAt: z.number().nullable(), source: z.string(),
});
export const bibleSearchSchema = z.object({
  text: z.string().trim().min(4, "Digite ao menos 4 caracteres.").max(100),
  page: z.number().int().min(0).max(2000),
});
export const bibleSearchIndexSchema = z.array(z.tuple([
  z.string().regex(/^[a-z0-9]{1,6}$/), z.number().int().min(1).max(150),
  z.number().int().min(1).max(176), z.string(),
])).max(32000);
export function resolveBibleVersion(preferred: BibleVersion | undefined, available: readonly BibleVersion[]): BibleVersion {
  if (preferred && available.includes(preferred)) return preferred;
  if (available.includes("aa")) return "aa";
  if (available[0]) return available[0];
  throw new Error("Nenhuma versão bíblica disponível.");
}
