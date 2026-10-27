import { z } from "zod";
import { dateSchema } from "./index";
import { bibleSelectionSchema } from "../sharing";

const devotional = z.object({
  id: z.string(), date: dateSchema, reference: z.string(), translation: z.string(),
  scripture: z.string(), reflection: z.string(), prayerSuggestion: z.string(),
  credit: z.string(), audioUrl: z.string().optional(), selection: bibleSelectionSchema.optional(),
});
const book = z.object({ abbrev: z.string(), name: z.string(), chapters: z.number(), testament: z.enum(["VT", "NT"]), order: z.number() });
const home = z.object({
  user: z.object({ id: z.string(), name: z.string() }), devotional: devotional.nullable(),
  settings: z.object({ monthlyVerse: z.string(), monthlyReference: z.string(), weeklyVerse: z.string(), weeklyReference: z.string() }).nullable(),
});
export const localCacheSchema = z.object({
  version: z.literal(1), owner: z.string(), day: z.string(),
  homes: z.record(dateSchema, home).refine(value => Object.keys(value).length <= 8),
  favorites: z.array(z.object({ devotional, favoritedAt: z.number() })),
  recent: z.array(devotional).max(7).optional(),
  catalog: z.object({ books: z.array(book), version: z.literal("aa"), verses: z.number(), importedAt: z.number().nullable(), source: z.string() }).optional(),
  chapterVisits: z.array(z.string()).max(6).optional(),
  chapters: z.array(z.object({
    book, chapter: z.number(),
    verses: z.array(z.object({ abbrev: z.string(), bookName: z.string(), chapter: z.number(), number: z.number(), text: z.string() })),
  })).max(6),
});
