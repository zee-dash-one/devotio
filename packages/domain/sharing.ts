import type { z } from "zod";
import { bibleSelectionSchema, notificationSummarySchema } from "./validators/sharing";
export { bibleSelectionSchema, notificationSummarySchema } from "./validators/sharing";
import type { BibleChapter } from "./reading";
import type { Watch, Message } from "./types";
import { bibleVersionNames } from "./validators/bible";
import type { notificationTargetSchema } from "./validators/sharing";

export type BibleSelection = z.infer<typeof bibleSelectionSchema>;
export interface BibleQuote extends BibleSelection { text: string; reference: string; versionName: string }
export function selectionRange(anchor: number, end: number) { return { first: Math.min(anchor, end), last: Math.max(anchor, end) }; }
export function selectionVerses(selection: BibleSelection): number[] {
  const valid = bibleSelectionSchema.parse(selection);
  return valid.verses ?? Array.from({ length: valid.last - valid.first + 1 }, (_, i) => valid.first + i);
}
export function toggleVerse(selection: BibleSelection | null, context: Pick<BibleSelection, "book" | "chapter" | "version">, number: number): BibleSelection | null {
  const current = selection && selection.book === context.book && selection.chapter === context.chapter && selection.version === context.version ? selectionVerses(selection) : [];
  const verses = current.includes(number) ? current.filter(n => n !== number) : [...current, number].sort((a, b) => a - b);
  return verses.length ? bibleSelectionSchema.parse({ ...context, first: verses[0], last: verses.at(-1), verses }) : null;
}
export function verseGroups(verses: readonly number[]): string {
  const groups: string[] = [];
  for (let i = 0; i < verses.length; i++) {
    const first = verses[i];
    while (i + 1 < verses.length && verses[i + 1] === verses[i] + 1) i++;
    groups.push(first === verses[i] ? String(first) : `${first}–${verses[i]}`);
  }
  return groups.join(", ");
}
export function bibleQuote(chapter: BibleChapter, selection: BibleSelection): BibleQuote {
  bibleSelectionSchema.parse(selection);
  if (selection.book !== chapter.book.abbrev || selection.chapter !== chapter.chapter) throw new Error("A seleção pertence a outro capítulo.");
  if ((chapter.version ?? "aa") !== selection.version) throw new Error("A seleção pertence a outra versão.");
  const numbers = selectionVerses(selection);
  const verses = numbers.map(number => chapter.verses.find(verse => verse.number === number));
  if (verses.some(verse => !verse)) throw new Error("Versículos não encontrados.");
  return { ...selection, text: verses.map(verse => `${verse!.number} - ${verse!.text}`).join("\n"), reference: `${chapter.book.name} ${selection.chapter}:${verseGroups(numbers)}`, versionName: bibleVersionNames[selection.version] };
}
export function quoteText(quote: BibleQuote) { return `${quote.text}\n\n${quote.reference}\n${quote.versionName}`; }
export function bibleQuotePath(quote: BibleSelection) { return `/biblia?book=${quote.book}&chapter=${quote.chapter}&verse=${quote.first}&verses=${selectionVerses(quote).join(",")}&version=${quote.version}`; }
export function notificationDate(at: number) { return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(at); }
export type NotificationSummary = z.infer<typeof notificationSummarySchema>;
export type NotificationKind = "friendShare" | "communityAccepted" | "communityRemoved" | "communityPost" | "system";
export interface AppNotification {
  id: string; type: "system" | "community"; entity: string; text: string;
  communityId: string | null; messageId: string | null; createdAt: number; readAt: number | null;
  kind?: NotificationKind; actorName?: string | null; communityName?: string | null;
  shareId?: string | null; target?: z.infer<typeof notificationTargetSchema> | null; available?: boolean;
}
export function notificationKind(item: AppNotification): NotificationKind { return item.kind ?? (item.type === "community" ? "communityPost" : "system"); }
export type NotificationDestination =
  | { to: "/biblia"; search: NonNullable<AppNotification["target"]> }
  | { to: "/comunidade/$communityId"; params: { communityId: string }; search?: { message: string } }
  | { to: "/comunidade" };
export function notificationTarget(item: AppNotification): NotificationDestination | null {
  const kind = notificationKind(item);
  if (kind === "communityRemoved") return { to: "/comunidade" };
  if (item.available === false) return null;
  if (kind === "friendShare") return item.target ? { to: "/biblia", search: item.target } : null;
  if (kind === "communityPost") return item.communityId && item.messageId ? { to: "/comunidade/$communityId", params: { communityId: item.communityId }, search: { message: item.messageId } } : null;
  if (kind === "communityAccepted") return item.communityId ? { to: "/comunidade/$communityId", params: { communityId: item.communityId } } : null;
  return { to: "/comunidade" };
}
export interface NotificationPage { items: AppNotification[]; nextCursor: string | null }
export interface NotificationsRepository {
  manualRefresh?: boolean;
  watchSummary(): Watch<NotificationSummary>;
  watchPage(cursor: string | null): Watch<NotificationPage>;
  markRead(id: string): Promise<void>;
  refresh(): Promise<void>;
}
export interface SharingRepository {
  watchDrafts(id: string): Watch<CommunityQuoteDraft[]>;
  saveDrafts(ids: string[], selection: BibleSelection, requestId: string): Promise<CommunityQuoteDraft[]>;
  updateDraft(id: string, draftId: string, selection: BibleSelection, comment: string): Promise<void>;
  publishDraft(id: string, draftId: string, selection: BibleSelection, comment: string): Promise<void>;
  deleteDraft(id: string, draftId: string): Promise<void>;
  sendQuote(id: string, selection: BibleSelection, comment: string, requestId: string): Promise<string>;
  message(id: string, messageId: string): Promise<Message>;
}
export interface CommunityQuoteDraft { id: string; communityId: string; quote: BibleQuote; comment: string; createdAt: number }
