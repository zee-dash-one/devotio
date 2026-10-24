import { z } from "zod";
import { bibleVersionSchema } from "./bible";
export const bibleSelectionSchema = z.object({
  book: z.string().regex(/^[a-z0-9]{1,6}$/), chapter: z.number().int().min(1).max(150),
  first: z.number().int().min(1).max(176), last: z.number().int().min(1).max(176), version: bibleVersionSchema,
  verses: z.array(z.number().int().min(1).max(176)).min(1).max(176).optional(),
}).refine(({ verses, first, last }) => first <= last && (!verses || (verses[0] === first && verses.at(-1) === last && verses.every((n, i) => i === 0 || n > verses[i - 1]))), "Ordene os versículos sem repetição e mantenha os limites da seleção.");
export const notificationSummarySchema = z.object({ unread: z.number().int().nonnegative(), revision: z.number().int().nonnegative(), capped: z.boolean().optional() });
export const notificationTargetSchema = z.object({ version: bibleVersionSchema, book: z.string().regex(/^[a-z0-9]{1,6}$/), chapter: z.number().int().min(1).max(150), verse: z.number().int().min(1).max(176) });
