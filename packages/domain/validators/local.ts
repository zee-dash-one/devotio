import { z } from "zod";
import { bibleVersionSchema, bibleSearchSchema } from "./bible";
import { bibleSelectionSchema } from "../sharing";
import { editorialMonthSchema } from "../editorial";
import { dateSchema, communitySchema, inviteSchema, messageSchema, scriptureSchema, checklistSchema, publicationSchema, scheduleSchema } from "./index";

export const timeZoneSchema = z.string().max(100).refine(value => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}, "Fuso horário inválido.");
const id = z.string().min(1).max(100);
export const bibleParamsSchema = z.object({
  book: z.string().regex(/^[a-z0-9]{1,6}$/).catch("jo"),
  chapter: z.coerce.number().int().min(1).max(150).catch(1),
  verse: z.coerce.number().int().min(1).max(176).optional().catch(undefined),
  pick: z.enum(["devotional", "community"]).optional().catch(undefined),
  q: z.string().max(100).optional().catch(undefined),
  version: bibleVersionSchema.optional().catch(undefined),
});
export const bibleDatasetSchema = z.array(z.object({
  abbrev: z.string().min(1), name: z.string().min(1),
  chapters: z.array(z.array(z.string().min(1)).min(1)).min(1),
})).length(66);
export const bibleBooksSchema = z.array(z.object({
  abbrev: z.object({ pt: z.string(), en: z.string() }), name: z.string(),
  chapters: z.number().int().positive(), testament: z.enum(["VT", "NT"]),
})).length(66);
export const localCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("login"), profileId: id }),
  z.object({ action: z.literal("logout") }),
  z.object({ action: z.literal("createCommunity"), input: communitySchema }),
  z.object({ action: z.literal("joinCommunity"), code: inviteSchema }),
  z.object({ action: z.literal("sendMessage"), id, content: messageSchema }),
  z.object({ action: z.literal("saveQuoteDrafts"), ids: z.array(id).min(1).max(50).refine(ids => new Set(ids).size === ids.length), selection: bibleSelectionSchema, requestId: z.string().uuid() }),
  ...(["updateQuoteDraft", "publishQuoteDraft"] as const).map(action => z.object({ action: z.literal(action), id, draftId: z.string().uuid(), selection: bibleSelectionSchema, comment: z.string().trim().max(1000, "Use até 1.000 caracteres no comentário.") })),
  z.object({ action: z.literal("deleteQuoteDraft"), id, draftId: z.string().uuid() }),
  z.object({ action: z.literal("sendQuote"), id, selection: bibleSelectionSchema, comment: z.string().trim().max(1000, "Use até 1.000 caracteres no comentário."), requestId: z.string().uuid() }),
  z.object({ action: z.literal("readNotification"), id }),
  z.object({ action: z.literal("updateScripture"), id, scripture: scriptureSchema }),
  z.object({ action: z.literal("createChecklist"), id, input: checklistSchema }),
  z.object({ action: z.literal("setTick"), itemId: id, checked: z.boolean() }),
  z.object({ action: z.literal("removeMember"), id, memberId: id }),
  z.object({ action: z.literal("setFavorite"), date: dateSchema, saved: z.boolean(), timeZone: timeZoneSchema }),
  z.object({ action: z.literal("restoreFavorite"), token: z.string().uuid() }),
  z.object({ action: z.literal("publish"), input: publicationSchema }),
  z.object({ action: z.literal("schedule"), input: scheduleSchema }),
  z.object({ action: z.literal("withdraw"), date: dateSchema, reason: z.string().trim().min(1).max(1000) }),
]);
export const localQuerySchema = z.discriminatedUnion("query", [
  z.object({ query: z.literal("session") }),
  z.object({ query: z.literal("home"), date: dateSchema, timeZone: timeZoneSchema }),
  z.object({ query: z.literal("devotionals"), dates: z.array(dateSchema).min(1).max(8).refine(dates => new Set(dates).size === dates.length), timeZone: timeZoneSchema }),
  z.object({ query: z.literal("reading"), timeZone: timeZoneSchema }),
  z.object({ query: z.literal("communities") }),
  z.object({ query: z.literal("community"), id, cursor: z.string().regex(/^\d+$/).max(20).nullable() }),
  z.object({ query: z.literal("communityMessage"), id, messageId: id }),
  z.object({ query: z.literal("quoteDrafts"), id }),
  z.object({ query: z.literal("notificationSummary") }),
  z.object({ query: z.literal("notifications"), cursor: z.string().regex(/^\d+$/).max(20).nullable() }),
  z.object({ query: z.literal("invite"), code: inviteSchema }),
  z.object({ query: z.literal("bible") }),
  z.object({ query: z.literal("chapter"), abbrev: z.string().regex(/^[a-z0-9]{1,6}$/), chapter: z.number().int().min(1).max(150) }),
  z.object({ query: z.literal("search"), ...bibleSearchSchema.shape }),
  z.object({ query: z.literal("editorial") }),
  z.object({ query: z.literal("editorialCalendar"), month: editorialMonthSchema, today: dateSchema }),
]);
export type LocalCommand = z.infer<typeof localCommandSchema>;
export type LocalQuery = z.infer<typeof localQuerySchema>;
