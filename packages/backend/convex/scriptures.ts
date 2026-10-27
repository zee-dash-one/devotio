import source from "../../../docs/bibles/ALM1911.json";
import { ConvexError } from "convex/values";
import { alm1911DatasetSchema, bibleSelectionSchema, bibleQuote, type BibleSelection } from "domain/core";
let corpus: ReturnType<typeof alm1911DatasetSchema.parse> | undefined;
/** Trusted server source. No scripture, author or edition label comes from the client. */
export function editorialScripture(input: BibleSelection) {
  const selection = bibleSelectionSchema.parse(input);
  if (selection.version !== "alm1911") throw new ConvexError("Esta tradução não está disponível para novas seleções.");
  corpus ??= alm1911DatasetSchema.parse(source);
  const book = corpus.find(book => book.abbrev === selection.book);
  const texts = book?.chapters[selection.chapter - 1];
  if (!book || !texts) throw new ConvexError("Capítulo bíblico não encontrado.");
  const { chapters, ...metadata } = book;
  return bibleQuote({ version: selection.version, book: { ...metadata, chapters: chapters.length }, chapter: selection.chapter,
    verses: texts.map((text, i) => ({ abbrev: book.abbrev, bookName: book.name, chapter: selection.chapter, number: i + 1, text })) }, selection);
}
