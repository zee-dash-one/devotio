import { v } from "convex/values";
import { scriptureSelectionValidator } from "./scriptureValidators";
export const notificationKindValidator = v.union(v.literal("friendShare"), v.literal("communityAccepted"), v.literal("communityRemoved"), v.literal("communityPost"), v.literal("system"));
export const notificationTargetValidator = v.object({ version: scriptureSelectionValidator.fields.version, book: v.string(), chapter: v.number(), verse: v.number() });
export const notificationValidator = v.object({
  id: v.string(), type: v.union(v.literal("system"), v.literal("community")), kind: notificationKindValidator,
  entity: v.string(), text: v.string(), actorName: v.union(v.string(), v.null()),
  communityId: v.union(v.string(), v.null()), communityName: v.union(v.string(), v.null()),
  messageId: v.union(v.string(), v.null()), shareId: v.union(v.string(), v.null()),
  target: v.union(notificationTargetValidator, v.null()), available: v.boolean(), createdAt: v.number(), readAt: v.union(v.number(), v.null()),
});
