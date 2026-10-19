import { v } from "convex/values";
import { scriptureSelectionValidator } from "./scriptureValidators";
export const quoteValidator = v.object({
  ...scriptureSelectionValidator.fields,
  text: v.string(),
  reference: v.string(),
  versionName: v.string(),
});
export const recipientValidator = v.object({
  id: v.id("users"),
  name: v.string(),
});
export const directionValidator = v.union(
  v.literal("sent"),
  v.literal("received"),
);
export const privateShareValidator = v.object({
  id: v.id("scriptureShares"),
  direction: directionValidator,
  senderName: v.string(),
  quote: quoteValidator,
  message: v.string(),
  sentAt: v.number(),
  recipients: v.optional(v.array(recipientValidator)),
});
export const chapterFilterValidator = v.object({
  version: scriptureSelectionValidator.fields.version,
  book: v.string(),
  chapter: v.number(),
});
