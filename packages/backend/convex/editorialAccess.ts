import { ConvexError, v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import {
  canManageEditorial,
  publicationSchema,
  editorialAuditSchema,
  editorialSaveSchema, editorialMonthDates, availableEditorialDates, canScheduleDate, publicationMidnight, dateSchema, scriptureLicense, validationMessage,
} from "domain/core";
import { editorialScripture } from "./scriptures";
import { scriptureSelectionValidator } from "./scriptureValidators";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./server";
import { findUser } from "./access";

const fields = {
  selection: v.optional(scriptureSelectionValidator),
  date: v.string(),
  reference: v.string(),
  translation: v.string(),
  scripture: v.string(),
  reflection: v.string(),
  prayerSuggestion: v.string(),
  credit: v.string(),
  licenseEvidence: v.string(),
  publishedAt: v.number(),
  audioUrl: v.optional(v.string()),
};
async function editor(ctx: QueryCtx) {
  const user = await findUser(ctx);
  if (!canManageEditorial(user))
    throw new ConvexError("Acesso exclusivo da gestão editorial.");
  return user;
}
export const list = query({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    entries: v.array(
      v.object({ ...fields, id: v.id("devotionals"), withdrawn: v.boolean() }),
    ),
    cursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await editor(ctx);
    const page = await ctx.db
      .query("devotionals")
      .withIndex("by_date")
      .order("desc")
      .paginate({ cursor: args.cursor, numItems: 25 });
    return {
      entries: page.page.map((d) => ({
        id: d._id,
        selection: d.selection,
        date: d.date,
        reference: d.reference,
        translation: d.translation,
        scripture: d.scripture,
        reflection: d.reflection,
        prayerSuggestion: d.prayerSuggestion,
        credit: d.credit,
        licenseEvidence: d.licenseEvidence,
        publishedAt: d.publishedAt,
        audioUrl: d.audioUrl,
        withdrawn: d.withdrawn,
      })),
      cursor: page.isDone ? null : page.continueCursor,
    };
  },
});
export const save = mutation({
  args: {
    date: v.string(), reflection: v.string(), prayerSuggestion: v.string(),
    selection: v.optional(scriptureSelectionValidator), reason: v.optional(v.string()),
    mode: v.union(v.literal("create"), v.literal("update")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await editor(ctx);
    const parsed = editorialSaveSchema.safeParse(args);
    if (!parsed.success) throw new ConvexError(validationMessage(parsed.error));
    const draft = parsed.data;
    const existing = await ctx.db
      .query("devotionals")
      .withIndex("by_date", (q) => q.eq("date", draft.date))
      .unique();
    if ((args.mode === "create") === !!existing)
      throw new ConvexError(
        existing
          ? "Esta data já possui um devocional. Use editar."
          : "Devocional não encontrado.",
      );
    if (draft.mode === "create" && !canScheduleDate(draft.date, Date.now()))
      throw new ConvexError("Escolha hoje ou uma data futura no horário de Brasília.");
    const selection = draft.selection ?? existing?.selection;
    const quote = draft.selection ? editorialScripture(draft.selection) : null;
    if (!quote && !existing) throw new ConvexError("Escolha o trecho na leitura bíblica.");
    const input = publicationSchema.parse({
      date: draft.date, reflection: draft.reflection, prayerSuggestion: draft.prayerSuggestion,
      scripture: quote?.text ?? existing?.scripture, reference: quote?.reference ?? existing?.reference,
      translation: quote?.versionName ?? existing?.translation,
      licenseEvidence: quote ? scriptureLicense : existing?.licenseEvidence,
      credit: existing?.credit ?? user.name, reviewedBy: user._id,
      publishedAt: publicationMidnight(draft.date),
      reason: draft.mode === "create" ? "Publicação inicial" : draft.reason,
      ...(selection ? { selection } : {}), ...(existing?.audioUrl ? { audioUrl: existing.audioUrl } : {}),
    });
    await ctx.runMutation(
      makeFunctionReference<"mutation">("editorial:publish"),
      input,
    );
    return null;
  },
});
export const get = query({
  args: { date: v.string() },
  returns: v.union(v.object({ ...fields, id: v.id("devotionals"), withdrawn: v.boolean() }), v.null()),
  handler: async (ctx, { date }) => {
    await editor(ctx);
    dateSchema.parse(date);
    const doc = await ctx.db.query("devotionals").withIndex("by_date", q => q.eq("date", date)).unique();
    if (!doc) return null;
    return { id: doc._id, date: doc.date, reference: doc.reference, translation: doc.translation,
      scripture: doc.scripture, reflection: doc.reflection, prayerSuggestion: doc.prayerSuggestion,
      credit: doc.credit, licenseEvidence: doc.licenseEvidence, publishedAt: doc.publishedAt,
      withdrawn: doc.withdrawn, audioUrl: doc.audioUrl, selection: doc.selection };
  },
});
export const calendar = query({
  args: { month: v.string(), today: v.string() },
  returns: v.object({ dates: v.array(v.string()), credit: v.string() }),
  handler: async (ctx, { month, today }) => {
    const user = await editor(ctx);
    const dates = editorialMonthDates(month);
    const docs = await ctx.db.query("devotionals")
      .withIndex("by_date", q => q.gte("date", dates[0]).lte("date", dates.at(-1)!)).take(32);
    return { dates: availableEditorialDates(month, docs.map(d => d.date), today), credit: user.name };
  },
});
export const withdraw = mutation({
  args: { id: v.id("devotionals"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await editor(ctx);
    const audit = editorialAuditSchema.parse({
      actor: user._id,
      reason: args.reason,
    });
    await ctx.runMutation(
      makeFunctionReference<"mutation">("editorial:withdraw"),
      { id: args.id, ...audit },
    );
    return null;
  },
});
