import type { Devotional, Watch } from "./types";
import type { z } from "zod";
import { dateSchema, type publicationSchema, type scheduleSchema } from "./validators";

export interface LocalProfile { id: string; name: string; label: string; description: string; editorial: boolean }
export interface Favorite { devotional: Devotional; favoritedAt: number }
export interface ReadingData { dates: string[]; favorites: Favorite[]; offline?: boolean; storageWarning?: string }
export interface BibleBook { abbrev: string; name: string; chapters: number; testament: "VT" | "NT"; order: number }
export interface BibleVerse { abbrev: string; bookName: string; chapter: number; number: number; text: string }
export interface BibleChapter { version?: import("./validators/bible").BibleVersion; book: BibleBook; chapter: number; verses: BibleVerse[] }
export interface BibleCatalog { books: BibleBook[]; version: import("./validators/bible").BibleVersion; verses: number; importedAt: number | null; source: string }
export interface BibleResults { verses: BibleVerse[]; total: number; page: number }
export type PublicationInput = z.infer<typeof publicationSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
export interface EditorialEntry { devotional: Devotional; withdrawn: boolean; publishedAt: number }
export interface ReadingRepository {
  watchReading(): Watch<ReadingData>;
  setFavorite(date: string, saved: boolean): Promise<string | null>;
  restoreFavorite(token: string): Promise<void>;
  watchBible(): Watch<BibleCatalog>;
  watchChapter(abbrev: string, chapter: number, preload?: boolean): Watch<BibleChapter | null>;
  watchSearch(query: string, page: number): Watch<BibleResults>;
  watchEditorial(): Watch<EditorialEntry[]>;
  editorialCalendar(month: string, today: string): Promise<string[]>;
  publish(input: PublicationInput): Promise<void>;
  schedule(input: ScheduleInput): Promise<void>;
  withdraw(date: string, reason: string): Promise<void>;
}
export type BibleReaderRepository = Pick<ReadingRepository, "watchBible" | "watchChapter" | "watchSearch">;
export interface BibleRepository {
  versions: readonly import("./validators/bible").BibleVersion[];
  forVersion(version: import("./validators/bible").BibleVersion): BibleReaderRepository;
}
export function dateInZone(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function recentDates(today: string): string[] {
  const day = Date.parse(today + "T12:00:00Z");
  return Array.from({ length: 8 }, (_, i) => new Date(day - i * 86400000).toISOString().slice(0, 10));
}
export function isRecent(date: string, today: string): boolean { return recentDates(today).includes(date); }
export function canPublish(editorial: boolean | undefined) { return editorial === true; }
export function publicationMidnight(date: string): number {
  dateSchema.parse(date);
  const target = Date.parse(date + "T00:00:00Z");
  let instant = target;
  const format = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(format.formatToParts(instant).map(part => [part.type, part.value]));
    const observed = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    if (observed === target) return instant;
    instant += target - observed;
  }
  throw new Error("Não foi possível programar meia-noite nesta data.");
}
export function canScheduleDate(date: string, now: number): boolean {
  return dateSchema.safeParse(date).success && date >= dateInZone("America/Sao_Paulo", new Date(now));
}
export function searchWords(query: string): string[] {
  return query.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}
