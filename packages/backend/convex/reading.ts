import { ConvexError, v } from "convex/values";
import {
  dateInZone,
  dateSchema,
  favoriteLimitMessage,
  isPublished,
  MAX_FAVORITE_DEVOTIONALS,
  RECENT_DEVOTIONALS_LIMIT,
  type Devotional,
  type Favorite,
  type ReadingData,
} from "domain/core";
import { findUser } from "./access";
import { mutation, query, type QueryCtx, type Id } from "./server";

function toDevotional(doc: {
  _id: Id<"devotionals">;
  date: string;
  reference: string;
  translation: string;
  scripture: string;
  reflection: string;
  prayerSuggestion: string;
  credit: string;
  audioUrl?: string;
  selection?: Devotional["selection"];
}): Devotional {
  return {
    id: doc._id, date: doc.date, reference: doc.reference,
    translation: doc.translation, scripture: doc.scripture,
    reflection: doc.reflection, prayerSuggestion: doc.prayerSuggestion,
    credit: doc.credit, audioUrl: doc.audioUrl, selection: doc.selection,
  };
}

async function recent(ctx: QueryCtx, today: string, now: number): Promise<Devotional[]> {
  const result: Devotional[] = [];
  for await (const doc of ctx.db.query("devotionals")
    .withIndex("by_date", q => q.lte("date", today)).order("desc")) {
    if (isPublished(doc.publishedAt, doc.withdrawn, now)) result.push(toDevotional(doc));
    if (result.length === RECENT_DEVOTIONALS_LIMIT) break;
  }
  return result;
}

export const get = query({
  args: { today: v.string() },
  handler: async (ctx, args): Promise<ReadingData> => {
    dateSchema.parse(args.today);
    const user = await findUser(ctx);
    const today = dateInZone("America/Sao_Paulo");
    const items = await recent(ctx, today, Date.now());
    const rows = await ctx.db.query("devotionalFavorites")
      .withIndex("by_userId", q => q.eq("userId", user._id)).take(100);
    const favorites = rows.map(row => JSON.parse(row.snapshot) as Favorite)
      .sort((a, b) => b.devotional.date.localeCompare(a.devotional.date));
    return { dates: items.map(item => item.date), recent: items, favorites };
  },
});

export const setFavorite = mutation({
  args: { date: v.string(), saved: v.boolean() },
  handler: async (ctx, args): Promise<string | null> => {
    const user = await findUser(ctx);
    const date = dateSchema.parse(args.date);
    const existing = await ctx.db.query("devotionalFavorites")
      .withIndex("by_userId_and_date", q => q.eq("userId", user._id).eq("date", date)).unique();
    if (!args.saved) {
      const receipt = await ctx.db.query("favoriteRestoreReceipts")
        .withIndex("by_userId", q => q.eq("userId", user._id)).unique();
      if (receipt) await ctx.db.delete(receipt._id);
      if (!existing) return null;
      const token = crypto.randomUUID();
      await ctx.db.insert("favoriteRestoreReceipts", { userId: user._id, token, snapshot: existing.snapshot });
      await ctx.db.delete(existing._id);
      return token;
    }
    if (existing) return null;
    const available = await recent(ctx, dateInZone("America/Sao_Paulo"), Date.now());
    const devotional = available.find(item => item.date === date);
    if (!devotional) throw new ConvexError("Este devocional não está disponível para favoritar.");
    const rows = await ctx.db.query("devotionalFavorites")
      .withIndex("by_userId", q => q.eq("userId", user._id)).take(MAX_FAVORITE_DEVOTIONALS);
    if (rows.length >= MAX_FAVORITE_DEVOTIONALS) throw new ConvexError(favoriteLimitMessage());
    const receipt = await ctx.db.query("favoriteRestoreReceipts")
      .withIndex("by_userId", q => q.eq("userId", user._id)).unique();
    if (receipt) await ctx.db.delete(receipt._id);
    const favorite: Favorite = { devotional, favoritedAt: Date.now() };
    await ctx.db.insert("devotionalFavorites", { userId: user._id, date, snapshot: JSON.stringify(favorite), favoritedAt: favorite.favoritedAt });
    return null;
  },
});

export const restoreFavorite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<null> => {
    const user = await findUser(ctx);
    const receipt = await ctx.db.query("favoriteRestoreReceipts")
      .withIndex("by_token", q => q.eq("token", args.token)).unique();
    if (!receipt || receipt.userId !== user._id)
      throw new ConvexError("Não foi possível desfazer esta remoção. Volte à leitura para favoritar novamente.");
    const favorite = JSON.parse(receipt.snapshot) as Favorite;
    const existing = await ctx.db.query("devotionalFavorites")
      .withIndex("by_userId_and_date", q => q.eq("userId", user._id).eq("date", favorite.devotional.date)).unique();
    const rows = await ctx.db.query("devotionalFavorites")
      .withIndex("by_userId", q => q.eq("userId", user._id)).take(MAX_FAVORITE_DEVOTIONALS);
    if (!existing && rows.length >= MAX_FAVORITE_DEVOTIONALS) throw new ConvexError(favoriteLimitMessage());
    if (!existing) await ctx.db.insert("devotionalFavorites", { userId: user._id, date: favorite.devotional.date, snapshot: receipt.snapshot, favoritedAt: favorite.favoritedAt });
    await ctx.db.delete(receipt._id);
    return null;
  },
});
