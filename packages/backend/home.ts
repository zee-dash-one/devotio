import { v } from "convex/values";
import { dateSchema, isPublished, type HomeData } from "domain/core";
import { query } from "./server";
import { findUser } from "./access";
export const get = query({
  args: { date: v.string() },
  handler: async (ctx, args): Promise<HomeData> => {
    const user = await findUser(ctx);
    const date = dateSchema.parse(args.date);
    const doc = await ctx.db
      .query("devotionals")
      .withIndex("by_date", (q) => q.eq("date", date))
      .unique();
    const settings = await ctx.db
      .query("globalSettings")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    return {
      user: { id: user._id, name: user.name },
      settings: settings && {
        monthlyVerse: settings.monthlyVerse,
        monthlyReference: settings.monthlyReference,
        weeklyVerse: settings.weeklyVerse,
        weeklyReference: settings.weeklyReference,
      },
      devotional:
        doc && isPublished(doc.publishedAt, doc.withdrawn, Date.now())
          ? {
              id: doc._id,
              selection: doc.selection,
              date: doc.date,
              reference: doc.reference,
              translation: doc.translation,
              scripture: doc.scripture,
              reflection: doc.reflection,
              prayerSuggestion: doc.prayerSuggestion,
              credit: doc.credit,
              audioUrl: doc.audioUrl,
            }
          : null,
    };
  },
});
