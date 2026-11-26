import { v } from "convex/values";
export const imageContentValidator = v.object({ date: v.string(), reference: v.string(), reflection: v.string(), prayerSuggestion: v.string() });
export const imageStateValidator = v.union(v.literal("pending"), v.literal("rendering"), v.literal("ready"), v.literal("failed"), v.literal("obsolete"));
export const imageFileValidator = v.object({ variant: v.string(), page: v.number(), pages: v.number(), width: v.number(), height: v.number(), bytes: v.number(), storageId: v.id("_storage") });
export const imageManifestValidator = v.object({ revision: v.string(), status: v.union(v.literal("pending"), v.literal("rendering"), v.literal("ready"), v.literal("failed"), v.literal("unavailable")), files: v.array(v.object({ variant: v.string(), page: v.number(), pages: v.number(), width: v.number(), height: v.number(), bytes: v.number(), url: v.string() })) });
