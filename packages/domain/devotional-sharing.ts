import type { Devotional } from "./types";
import { dateSchema } from "./validators";
import { bibleSelectionSchema, selectionVerses, verseGroups, type BibleQuote, type BibleSelection } from "./sharing";

export function devotionalShareText(day: Devotional, appUrl: string): string {
  return `Devocional de ${dateSchema.parse(day.date).split("-").reverse().join("/")}\n\nPALAVRA\n${day.reference} — ${day.translation}\n\n${day.scripture}\n\nMEDITAR\n\n${day.reflection}\n\nORAÇÃO\n\n${day.prayerSuggestion}\n\nDevotio — ${appUrl}`;
}
export function devotionalSectionText(day: Devotional, section: "reflection" | "prayerSuggestion"): string {
  return `${day[section]}\n\n${day.reference}`;
}
/** Use the published snapshot; never infer a Bible selection from a legacy reference. */
export function devotionalVerses(day: Devotional): { number: number; text: string }[] {
  const parsed = bibleSelectionSchema.safeParse(day.selection);
  if (!parsed.success) return [];
  const lines = day.scripture.split("\n").filter(Boolean).map(line => /^(\d+)\s*-\s*(.+)$/.exec(line));
  const numbers = selectionVerses(parsed.data);
  if (lines.length !== numbers.length || lines.some((line, i) => !line || Number(line[1]) !== numbers[i])) return [];
  return lines.map(line => ({ number: Number(line![1]), text: line![2] }));
}
export function devotionalQuote(day: Devotional, selection: BibleSelection): BibleQuote | null {
  const source = day.selection;
  if (!source || source.book !== selection.book || source.chapter !== selection.chapter || source.version !== selection.version) return null;
  const verses = devotionalVerses(day), numbers = selectionVerses(selection);
  const picked = numbers.map(number => verses.find(verse => verse.number === number));
  const prefix = day.reference.lastIndexOf(` ${source.chapter}:`);
  if (prefix < 0 || picked.some(verse => !verse)) return null;
  return { ...selection, reference: `${day.reference.slice(0, prefix)} ${selection.chapter}:${verseGroups(numbers)}`, text: picked.map(verse => `${verse!.number} - ${verse!.text}`).join("\n"), versionName: day.translation };
}
