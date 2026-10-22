import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { scriptureSelectionValidator } from "./scriptureValidators";
import { quoteValidator, recipientValidator, directionValidator } from "./socialValidators";
export default defineSchema({
  friendCodes: defineTable({ userId: v.id("users"), code: v.string() })
    .index("by_userId", ["userId"]).index("by_code", ["code"]),
  friendships: defineTable({ low: v.id("users"), high: v.id("users"), requesterId: v.id("users"), state: v.union(v.literal("pending"), v.literal("accepted")) })
    .index("by_low_and_high", ["low", "high"]).index("by_high", ["high"]),
  scriptureShares: defineTable({ senderId: v.id("users"), senderName: v.string(), requestId: v.string(), fingerprint: v.string(), recipients: v.array(recipientValidator), quote: quoteValidator, message: v.string(), sentAt: v.number() })
    .index("by_senderId_and_requestId", ["senderId", "requestId"]),
  shareMarkers: defineTable({ ownerId: v.id("users"), direction: directionValidator, version: scriptureSelectionValidator.fields.version, book: v.string(), chapter: v.number(), first: v.number() })
    .index("by_ownerId_version_book_chapter_first_direction", ["ownerId", "version", "book", "chapter", "first", "direction"]),
  shareViews: defineTable({ ownerId: v.id("users"), shareId: v.id("scriptureShares"), direction: directionValidator, version: scriptureSelectionValidator.fields.version, book: v.string(), chapter: v.number(), first: v.number() })
    .index("by_ownerId_version_book_chapter_first_direction", ["ownerId", "version", "book", "chapter", "first", "direction"])
    .index("by_ownerId", ["ownerId"])
    .index("by_ownerId_and_direction", ["ownerId", "direction"])
    .index("by_ownerId_and_version_and_book_and_chapter", ["ownerId", "version", "book", "chapter"])
    .index("by_ownerId_and_version_and_book_and_chapter_and_direction", ["ownerId", "version", "book", "chapter", "direction"]),
  users: defineTable({
    authId: v.optional(v.string()),
    tokenIdentifier: v.optional(v.string()),
    name: v.string(),
    email: v.string(),
    normalizedEmail: v.optional(v.string()),
    normalizedName: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("disabled"),
      ),
    ),
    editorial: v.optional(v.boolean()),
    communityCreationAllowed: v.optional(v.boolean()),
    communityCreationLimit: v.optional(v.number()),
  })
    .index("by_authId", ["authId"])
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .index("by_normalizedEmail", ["normalizedEmail"])
    .index("by_normalizedName", ["normalizedName"])
    .index("by_status_and_normalizedEmail", ["status", "normalizedEmail"])
    .index("by_status_and_normalizedName", ["status", "normalizedName"]),
  adminSessions: defineTable({
    tokenHash: v.string(),
    credentialVersion: v.string(),
    expiresAt: v.number(),
  }).index("by_tokenHash", ["tokenHash"]),
  adminSecurity: defineTable({
    key: v.literal("owner"),
    lastTotpCounter: v.number(),
    credentialVersion: v.string(),
  }).index("by_key", ["key"]),
  accessSettings: defineTable({
    key: v.literal("main"),
    approvalRequired: v.boolean(),
  }).index("by_key", ["key"]),
  userAdminEvents: defineTable({
    actor: v.string(),
    target: v.string(),
    action: v.string(),
    at: v.number(),
  }).index("by_target", ["target"]),
  devotionals: defineTable({
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
    audioUrl: v.optional(v.string()),
    withdrawn: v.boolean(),
    updatedAt: v.number(),
  }).index("by_date", ["date"]),
  editorialEvents: defineTable({
    devotionalId: v.id("devotionals"),
    actor: v.string(),
    reason: v.string(),
    action: v.union(v.literal("publish"), v.literal("withdraw")),
    at: v.number(),
  }).index("by_devotional", ["devotionalId"]),
  globalSettings: defineTable({
    key: v.literal("main"),
    monthlyVerse: v.string(),
    monthlyReference: v.string(),
    weeklyVerse: v.string(),
    weeklyReference: v.string(),
  }).index("by_key", ["key"]),
  communities: defineTable({
    ownerId: v.optional(v.id("users")),
    name: v.string(),
    description: v.string(),
    scripture: v.string(),
    inviteCode: v.string(),
    createdAt: v.number(),
  }).index("by_invite", ["inviteCode"]).index("by_ownerId", ["ownerId"]),
  communityJoinRequests: defineTable({
    communityId: v.id("communities"), userId: v.id("users"),
    state: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("cancelled")),
    requestedAt: v.number(), decidedAt: v.optional(v.number()), decidedBy: v.optional(v.id("users")),
  }).index("by_communityId_and_state", ["communityId", "state"])
    .index("by_communityId_and_userId", ["communityId", "userId"])
    .index("by_userId_and_state", ["userId", "state"])
    .index("by_userId", ["userId"]),
  communityMembers: defineTable({
    userId: v.id("users"),
    communityId: v.id("communities"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
  })
    .index("by_user", ["userId"])
    .index("by_community", ["communityId"])
    .index("by_pair", ["communityId", "userId"]),
  communityMessages: defineTable({
    communityId: v.id("communities"),
    senderId: v.id("users"),
    content: v.string(),
    sentAt: v.number(),
  }).index("by_community_time", ["communityId", "sentAt"]),
  checklists: defineTable({
    communityId: v.id("communities"),
    name: v.string(),
  }).index("by_community", ["communityId"]),
  checklistItems: defineTable({
    checklistId: v.id("checklists"),
    text: v.string(),
    order: v.number(),
  }).index("by_checklist", ["checklistId"]),
  checklistTicks: defineTable({
    itemId: v.id("checklistItems"),
    userId: v.id("users"),
  })
    .index("by_item", ["itemId"])
    .index("by_pair", ["itemId", "userId"]),
});
