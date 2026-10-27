import { v } from "convex/values";
import {
  publicationSchema,
  editorialAuditSchema,
  themesSchema,
} from "domain/core";
import { makeFunctionReference } from "convex/server";
import { internalMutation } from "./server";
import { scriptureSelectionValidator } from "./scriptureValidators";
import { queueImageSet, obsoleteImageSet } from "./imageQueue";
export const publish = internalMutation({
  args: {
    selection: v.optional(scriptureSelectionValidator),
    date: v.string(),
    reference: v.string(),
    translation: v.string(),
    scripture: v.string(),
    reflection: v.string(),
    prayerSuggestion: v.string(),
    credit: v.string(),
    licenseEvidence: v.string(),
    reviewedBy: v.string(),
    publishedAt: v.number(),
    reason: v.string(),
    audioUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { reason, ...input } = publicationSchema.parse(args);
    const current = await ctx.db
      .query("devotionals")
      .withIndex("by_date", (q) => q.eq("date", input.date))
      .unique();
    const data = { ...input, withdrawn: false, updatedAt: Date.now() };
    let id;
    if (current) {
      await ctx.db.patch(current._id, data);
      id = current._id;
    } else id = await ctx.db.insert("devotionals", data);
    await ctx.db.insert("editorialEvents", {
      devotionalId: id,
      actor: input.reviewedBy,
      reason,
      action: "publish",
      at: Date.now(),
    });
    if (input.publishedAt > Date.now())
      await ctx.scheduler.runAt(
        input.publishedAt,
        makeFunctionReference<"mutation">("editorial:release"),
        { id },
      );
    await queueImageSet(ctx, id);
    return id;
  },
});
export const withdraw = internalMutation({
  args: { id: v.id("devotionals"), actor: v.string(), reason: v.string() },
  handler: async (ctx, args) => {
    const audit = editorialAuditSchema.parse(args);
    const doc = await ctx.db.get(args.id);
    if (doc?.imageSetId) await obsoleteImageSet(ctx, doc.imageSetId);
    await ctx.db.patch(args.id, { withdrawn: true, updatedAt: Date.now() });
    await ctx.db.insert("editorialEvents", {
      devotionalId: args.id,
      ...audit,
      action: "withdraw",
      at: Date.now(),
    });
  },
});
export const setThemes = internalMutation({
  args: {
    monthlyVerse: v.string(),
    monthlyReference: v.string(),
    weeklyVerse: v.string(),
    weeklyReference: v.string(),
  },
  handler: async (ctx, args) => {
    const input = themesSchema.parse(args);
    const current = await ctx.db
      .query("globalSettings")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    if (current) await ctx.db.patch(current._id, input);
    else await ctx.db.insert("globalSettings", { key: "main", ...input });
  },
});
// Invalidate active subscriptions at the release time; Date.now alone is not reactive.
export const release = internalMutation({
  args: { id: v.id("devotionals") },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (doc && !doc.withdrawn && doc.publishedAt <= Date.now())
      await ctx.db.patch(id, { updatedAt: Date.now() });
  },
});
