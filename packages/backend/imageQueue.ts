import { Workpool } from "@convex-dev/workpool";
import type { ComponentApi } from "@convex-dev/workpool/_generated/component.js";
import { componentsGeneric, makeFunctionReference } from "convex/server";
import { imageContent, imageRevision, IMAGE_RETENTION_DAYS } from "domain/core";
import type { MutationCtx, Id } from "./server";
const components = componentsGeneric() as unknown as { imageWorkpool: ComponentApi };
export const imagePool = new Workpool(components.imageWorkpool, { maxParallelism: 1, retryActionsByDefault: true, defaultRetryBehavior: { maxAttempts: 3, initialBackoffMs: 5000, base: 3 } });
export async function queueImageSet(ctx: MutationCtx, id: Id<"devotionals">, retry = false) {
  if (process.env.DEVOTIONAL_IMAGES_ENABLED === "false") return null;
  const doc = await ctx.db.get(id);
  if (!doc || doc.withdrawn) return null;
  const content = imageContent(doc), revision = imageRevision(content);
  const expiresAt = Date.parse(doc.date + "T03:00:00Z") + IMAGE_RETENTION_DAYS * 86400000;
  if (expiresAt <= Date.now()) return null;
  if (doc.imageSetId && doc.imageRevision !== revision) await obsoleteImageSet(ctx, doc.imageSetId);
  let set = await ctx.db.query("devotionalImageSets").withIndex("by_devotional_revision", q => q.eq("devotionalId", id).eq("revision", revision)).unique();
  if (!set) {
    const setId = await ctx.db.insert("devotionalImageSets", { devotionalId: id, revision, content, status: "pending", generation: 0, attempts: 0, files: [], updatedAt: Date.now(), expiresAt });
    set = (await ctx.db.get(setId))!;
  }
  await ctx.db.patch(id, { imageSetId: set._id, imageRevision: revision });
  if (set.status === "ready" || ((set.status === "pending" || set.status === "rendering") && set.workId) || (set.status === "failed" && !retry)) return set._id;
  const generation = set.generation + 1;
  await ctx.db.patch(set._id, { generation, attempts: 0, status: "pending", updatedAt: Date.now(), error: undefined });
  const workId = await imagePool.enqueueAction(ctx, makeFunctionReference<"action">("imageActions:generate"), { id: set._id, generation }, { onComplete: makeFunctionReference<"mutation">("devotionalImages:completed"), context: { id: set._id, generation } });
  await ctx.db.patch(set._id, { workId });
  return set._id;
}
export async function obsoleteImageSet(ctx: MutationCtx, id: Id<"devotionalImageSets">) {
  const set = await ctx.db.get(id);
  if (!set) return;
  // Deletion is part of this transaction, so withdrawal hides the origin files too.
  for (const file of set.files) await ctx.storage.delete(file.storageId);
  await ctx.db.patch(id, { status: "obsolete", files: [], updatedAt: Date.now() });
}
