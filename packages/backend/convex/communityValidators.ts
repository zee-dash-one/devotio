import { v } from "convex/values";
import { quoteValidator } from "./socialValidators";
export const roleValidator = v.union(v.literal("owner"), v.literal("admin"), v.literal("member"));
export const creationValidator = v.object({ allowed: v.boolean(), limit: v.number(), owned: v.number(), canCreate: v.boolean() });
export const requestValidator = v.object({
  id: v.id("communityJoinRequests"), communityId: v.id("communities"), communityName: v.string(),
  userId: v.id("users"), name: v.string(), requestedAt: v.number(),
  state: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("cancelled")),
});
export const requestPageValidator = v.object({ items: v.array(requestValidator), cursor: v.union(v.string(), v.null()) });
// Presentation contracts use opaque strings shared with the SQLite adapter.
export const communityValidator = v.object({ id: v.string(), name: v.string(), description: v.string(), scripture: v.string(), role: roleValidator, memberId: v.optional(v.string()), inviteCode: v.optional(v.string()), pendingRequests: v.optional(v.number()) });
export const communityDetailValidator = v.object({
  community: communityValidator,
  members: v.array(v.object({ id: v.string(), userId: v.string(), name: v.string(), role: roleValidator })),
  messages: v.array(v.object({ id: v.string(), content: v.string(), name: v.string(), sentAt: v.number(), quote: v.optional(quoteValidator) })),
  lists: v.array(v.object({ id: v.string(), name: v.string(), items: v.array(v.object({ id: v.string(), text: v.string(), checked: v.boolean(), count: v.number() })) })),
  hasMore: v.boolean(), nextCursor: v.union(v.string(), v.null()),
});
