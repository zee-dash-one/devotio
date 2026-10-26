"use node";
import { createHash } from "node:crypto";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { internalAction } from "./_generated/server";
import { renderImages } from "./rendering/images.node";
import type { ImageContent } from "domain/core";
import type { Id } from "./server";
const claimRef = makeFunctionReference<"mutation", { id: Id<"devotionalImageSets">; generation: number }, { run: number; content: ImageContent; files: { variant: string; page: number }[] } | null>("devotionalImages:claim");
export const generate = internalAction({
  args: { id: v.id("devotionalImageSets"), generation: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.runMutation(claimRef, args);
    if (!job) return null;
    for await (const { png, ...file } of renderImages(job.content)) {
      if (job.files.some(existing => existing.variant === file.variant && existing.page === file.page)) continue;
      const uploadId: Id<"devotionalImageUploads"> | null = await ctx.runMutation(makeFunctionReference<"mutation">("devotionalImages:prepareUpload"), { ...args, run: job.run, sha256: createHash("sha256").update(png).digest("base64") });
      if (!uploadId) return null;
      const storageId = await ctx.storage.store(new Blob([new Uint8Array(png)], { type: "image/png" }));
      try {
        const accepted = await ctx.runMutation(makeFunctionReference<"mutation">("devotionalImages:registerFile"), { ...args, run: job.run, uploadId, file: { ...file, bytes: png.byteLength, storageId } });
        if (!accepted) return null;
      } catch (error) { await ctx.storage.delete(storageId); throw error; }
    }
    await ctx.runMutation(makeFunctionReference<"mutation">("devotionalImages:finish"), { ...args, run: job.run }); return null;
  },
});
