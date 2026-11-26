import { v, ConvexError } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { vOnCompleteValidator } from "@convex-dev/workpool";
import { imageRequestSchema, imageAvailableToday, isPublished, canManageEditorial, dateSchema, imageSizes, imageStyles, dateInZone } from "domain/core";
import { query, mutation, internalMutation } from "./server";
import { imageContentValidator, imageFileValidator, imageManifestValidator } from "./imageValidators";
import { findUser } from "./access";
import { queueImageSet, obsoleteImageSet, imagePool } from "./imageQueue";
import type { WorkId } from "@convex-dev/workpool";

export const get = query({
  args: { id: v.id("devotionals"), revision: v.string() }, returns: imageManifestValidator,
  handler: async (ctx, args) => {
    await findUser(ctx); imageRequestSchema.parse(args);
    const unavailable = { revision: args.revision, status: "unavailable" as const, files: [] };
    if (process.env.DEVOTIONAL_IMAGES_ENABLED === "false") return unavailable;
    const doc = await ctx.db.get(args.id);
    if (!doc || !isPublished(doc.publishedAt, doc.withdrawn, Date.now()) || !imageAvailableToday(doc.date, Date.now()) || doc.imageRevision !== args.revision || !doc.imageSetId) return unavailable;
    const set = await ctx.db.get(doc.imageSetId);
    if (!set || set.revision !== args.revision || set.status === "obsolete" || set.expiresAt <= Date.now()) return unavailable;
    const files = set.status === "ready" ? await Promise.all(set.files.map(async ({ storageId, ...file }) => ({ ...file, url: await ctx.storage.getUrl(storageId) }))) : [];
    if (files.some(file => !file.url)) return { ...unavailable, status: "failed" as const };
    return { revision: set.revision, status: set.status, files: files.map(file => ({ ...file, url: file.url! })) };
  },
});
export const retry = mutation({
  args: { id: v.id("devotionals") }, returns: v.union(v.id("devotionalImageSets"), v.null()),
  handler: async (ctx, { id }) => {
    const user = await findUser(ctx);
    if (!canManageEditorial(user)) throw new ConvexError("Acesso exclusivo da gestão editorial.");
    return queueImageSet(ctx, id, true);
  },
});
export const claim = internalMutation({
  args: { id: v.id("devotionalImageSets"), generation: v.number() },
  returns: v.union(v.null(), v.object({ run: v.number(), content: imageContentValidator, files: v.array(imageFileValidator) })),
  handler: async (ctx, { id, generation }) => {
    const set = await ctx.db.get(id);
    if (!set || set.generation !== generation || set.status === "obsolete" || set.status === "ready") return null;
    const doc = await ctx.db.get(set.devotionalId);
    if (!doc || doc.withdrawn || doc.imageSetId !== id || set.expiresAt <= Date.now()) { await obsoleteImageSet(ctx, id); return null; }
    const run = set.attempts + 1;
    await ctx.db.patch(id, { status: "rendering", attempts: run, updatedAt: Date.now() });
    return { run, content: set.content, files: set.files };
  },
});
export const prepareUpload = internalMutation({
  args: { id: v.id("devotionalImageSets"), generation: v.number(), run: v.number(), sha256: v.string() }, returns: v.union(v.id("devotionalImageUploads"), v.null()),
  handler: async (ctx, args) => {
    const set = await ctx.db.get(args.id);
    if (!set || set.status !== "rendering" || set.attempts !== args.run || set.generation !== args.generation) return null;
    return ctx.db.insert("devotionalImageUploads", { setId: args.id, sha256: args.sha256, expiresAt: set.expiresAt + 86400000 });
  },
});
export const registerFile = internalMutation({
  args: { id: v.id("devotionalImageSets"), generation: v.number(), run: v.number(), uploadId: v.id("devotionalImageUploads"), file: imageFileValidator }, returns: v.boolean(),
  handler: async (ctx, args) => {
    const set = await ctx.db.get(args.id), upload = await ctx.db.get(args.uploadId);
    if (!set || !upload || upload.setId !== args.id || set.status !== "rendering" || set.attempts !== args.run || set.generation !== args.generation) { await ctx.storage.delete(args.file.storageId); return false; }
    if (set.files.some(file => file.variant === args.file.variant && file.page === args.file.page)) { await ctx.storage.delete(args.file.storageId); return true; }
    await ctx.db.patch(args.uploadId, { storageId: args.file.storageId });
    await ctx.db.patch(args.id, { files: [...set.files, args.file], updatedAt: Date.now() });
    return true;
  },
});
export const finish = internalMutation({
  args: { id: v.id("devotionalImageSets"), generation: v.number(), run: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    const set = await ctx.db.get(args.id);
    if (!set || set.status !== "rendering" || set.attempts !== args.run || set.generation !== args.generation) return null;
    const doc = await ctx.db.get(set.devotionalId);
    if (!doc || doc.withdrawn || doc.imageSetId !== args.id) { await obsoleteImageSet(ctx, args.id); return null; }
    for (const size of imageSizes) for (const style of imageStyles) {
      const files = set.files.filter(file => file.variant === size.id + "-" + style.id).sort((a,b) => a.page-b.page);
      if (!files.length || files.length !== files[0].pages || files.some((file, i) => file.page !== i+1 || file.pages !== files.length || file.width !== size.width || file.height !== size.height)) throw new Error("Conjunto de imagens incompleto.");
    }
    await ctx.db.patch(args.id, { status: "ready", updatedAt: Date.now(), error: undefined }); return null;
  },
});
export const completed = internalMutation({
  args: vOnCompleteValidator(v.object({ id: v.id("devotionalImageSets"), generation: v.number() })), returns: v.null(),
  handler: async (ctx, { context, result }) => {
    const set = await ctx.db.get(context.id);
    if (set && set.generation === context.generation && set.status !== "ready" && set.status !== "obsolete") await ctx.db.patch(set._id, { status: "failed", updatedAt: Date.now(), error: result.kind === "failed" ? "Falha na geração. Tente novamente pelo painel editorial." : "Geração interrompida." });
    return null;
  },
});
export const ensureDates = internalMutation({
  args: { dates: v.array(v.string()), dryRun: v.boolean() }, returns: v.array(v.id("devotionals")),
  handler: async (ctx, args) => {
    if (args.dates.length > 31) throw new Error("Limite de 31 datas por execução.");
    const ids = [];
    for (const raw of args.dates) {
      const date = dateSchema.parse(raw);
      const doc = await ctx.db.query("devotionals").withIndex("by_date", q => q.eq("date", date)).unique();
      if (doc && !doc.withdrawn) { ids.push(doc._id); if (!args.dryRun) await queueImageSet(ctx, doc._id, true); }
    }
    return ids;
  },
});
export const cleanup = internalMutation({
  args: {}, returns: v.null(),
  handler: async ctx => {
    for (const set of await ctx.db.query("devotionalImageSets").withIndex("by_expiresAt", q => q.lt("expiresAt", Date.now())).take(4)) { await obsoleteImageSet(ctx, set._id); await ctx.db.delete(set._id); }
    for (const state of ["pending", "rendering"] as const) for (const set of await ctx.db.query("devotionalImageSets").withIndex("by_status_updatedAt", q => q.eq("status", state).lt("updatedAt", Date.now()-20*60000)).take(10)) {
      if (set.workId && (await imagePool.status(ctx, set.workId as WorkId)).state === "finished") await ctx.db.patch(set._id, { status: "failed", updatedAt: Date.now(), error: "Geração interrompida. Tente novamente pelo painel editorial." });
    }
    return null;
  },
});
export const cleanupOrphans = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) }, returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db.system.query("_storage").paginate({ cursor: args.cursor, numItems: 100 });
    for (const file of page.page) {
      if (file._creationTime > Date.now()-3600000) continue;
      const owned = await ctx.db.query("devotionalImageUploads").withIndex("by_sha256", q => q.eq("sha256", file.sha256)).first();
      if (!owned) continue; // Never delete storage belonging to another feature.
      const registered = await ctx.db.query("devotionalImageUploads").withIndex("by_storageId", q => q.eq("storageId", file._id)).first();
      const set = registered && await ctx.db.get(registered.setId);
      if (!set || set.status === "obsolete" || set.expiresAt <= Date.now()) await ctx.storage.delete(file._id);
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("devotionalImages:cleanupOrphans"), { cursor: page.continueCursor });
    else for (const upload of await ctx.db.query("devotionalImageUploads").withIndex("by_expiresAt", q => q.lt("expiresAt", Date.now())).take(200)) await ctx.db.delete(upload._id);
    return null;
  },
});

export const changeDay = internalMutation({
  args: {}, returns: v.null(),
  handler: async ctx => {
    for (const offset of [-86400000, 0]) {
      const date = dateInZone("America/Sao_Paulo", new Date(Date.now()+offset));
      const doc = await ctx.db.query("devotionals").withIndex("by_date", q => q.eq("date", date)).unique();
      if (doc) await ctx.db.patch(doc._id, { updatedAt: Date.now() });
    }
    return null;
  },
});
