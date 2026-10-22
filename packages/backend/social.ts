import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx, Id } from "./server";
import { findUser } from "./access";
import { notify } from "./notifications";
import { editorialScripture } from "./scriptures";
import { scriptureSelectionValidator } from "./scriptureValidators";
import {
  chapterFilterValidator,
  directionValidator,
  privateShareValidator,
} from "./socialValidators";
import {
  assertFriendCapacity,
  assertFriendChange,
  assertFriendRecipient,
  friendPair,
  friendView,
  privateShare,
  friendRequestSchema,
  friendChangeSchema,
  shareInputSchema,
  shareFilterSchema,
  shareFingerprint,
  hasApprovedAccess,
  MAX_FRIENDS,
  validationMessage,
} from "domain/core";

function rule<T>(check: () => T): T {
  try {
    return check();
  } catch (error) {
    throw new ConvexError(validationMessage(error));
  }
}

async function links(ctx: QueryCtx, id: Id<"users">) {
  const [low, high] = await Promise.all([
    ctx.db
      .query("friendships")
      .withIndex("by_low_and_high", (q) => q.eq("low", id))
      .take(MAX_FRIENDS + 1),
    ctx.db
      .query("friendships")
      .withIndex("by_high", (q) => q.eq("high", id))
      .take(MAX_FRIENDS + 1),
  ]);
  return [...low, ...high];
}
async function pair(ctx: QueryCtx, actor: Id<"users">, other: Id<"users">) {
  const { low, high } = rule(() => friendPair(actor, other));
  return ctx.db
    .query("friendships")
    .withIndex("by_low_and_high", (q) =>
      q.eq("low", low as Id<"users">).eq("high", high as Id<"users">),
    )
    .unique();
}
export const friends = query({
  args: {},
  returns: v.object({
    userId: v.id("users"),
    code: v.union(v.string(), v.null()),
    friends: v.array(
      v.object({
        id: v.id("friendships"),
        userId: v.id("users"),
        name: v.string(),
        state: v.union(
          v.literal("friend"),
          v.literal("incoming"),
          v.literal("outgoing"),
        ),
        available: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const actor = await findUser(ctx);
    const code = await ctx.db
      .query("friendCodes")
      .withIndex("by_userId", (q) => q.eq("userId", actor._id))
      .unique();
    const friends = await Promise.all(
      (await links(ctx, actor._id)).map(async (link) => {
        const other = await ctx.db.get(
          link.low === actor._id ? link.high : link.low,
        );
        const view = friendView(
          { ...link, id: link._id },
          actor._id,
          other?.name ?? "Conta indisponível",
          !!other && hasApprovedAccess(other.status),
        );
        return { ...view, id: link._id, userId: view.userId as Id<"users"> };
      }),
    );
    return { userId: actor._id, code: code?.code ?? null, friends };
  },
});
export const rotateCode = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const actor = await findUser(ctx);
    const existing = await ctx.db
      .query("friendCodes")
      .withIndex("by_userId", (q) => q.eq("userId", actor._id))
      .unique();
    // This is an invitation locator, never authentication. Acceptance remains mandatory.
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = Array.from(
        { length: 12 },
        () => alphabet[Math.floor(Math.random() * alphabet.length)],
      ).join("");
      if (
        await ctx.db
          .query("friendCodes")
          .withIndex("by_code", (q) => q.eq("code", code))
          .unique()
      )
        continue;
      if (existing) await ctx.db.patch(existing._id, { code });
      else await ctx.db.insert("friendCodes", { userId: actor._id, code });
      return code;
    }
    throw new ConvexError("Não foi possível gerar o código. Tente novamente.");
  },
});
export const request = mutation({
  args: {
    input: v.union(
      v.object({ kind: v.literal("code"), code: v.string() }),
      v.object({
        kind: v.literal("community"),
        communityId: v.id("communities"),
        userId: v.id("users"),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await findUser(ctx),
      input = rule(() => friendRequestSchema.parse(args.input));
    let target: Id<"users">;
    if (input.kind === "code") {
      const code = await ctx.db
        .query("friendCodes")
        .withIndex("by_code", (q) => q.eq("code", input.code))
        .unique();
      if (!code)
        throw new ConvexError(
          "Código indisponível. Peça um novo código à pessoa.",
        );
      target = code.userId;
    } else {
      target = input.userId as Id<"users">;
      for (const id of [actor._id, target]) {
        const member = await ctx.db
          .query("communityMembers")
          .withIndex("by_pair", (q) =>
            q
              .eq("communityId", input.communityId as Id<"communities">)
              .eq("userId", id),
          )
          .unique();
        if (!member)
          throw new ConvexError("Vocês precisam participar desta comunidade.");
      }
    }
    const other = await ctx.db.get(target);
    if (!other || !hasApprovedAccess(other.status))
      throw new ConvexError("Esta pessoa não está disponível para convites.");
    if (await pair(ctx, actor._id, target)) return null;
    for (const id of [actor._id, target]) {
      const count = (await links(ctx, id)).length;
      rule(() => assertFriendCapacity(count));
    }
    const { low, high } = friendPair(actor._id, target);
    await ctx.db.insert("friendships", {
      low: low as Id<"users">,
      high: high as Id<"users">,
      requesterId: actor._id,
      state: "pending",
    });
    return null;
  },
});
export const change = mutation({
  args: {
    id: v.id("friendships"),
    action: v.union(v.literal("accept"), v.literal("remove")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await findUser(ctx),
      input = rule(() => friendChangeSchema.parse(args));
    const link = await ctx.db.get(args.id);
    if (!link) throw new ConvexError("Convite ou amizade não encontrado.");
    rule(() =>
      assertFriendChange({ ...link, id: link._id }, actor._id, input.action),
    );
    if (input.action === "accept") {
      const other = await ctx.db.get(link.requesterId);
      if (!other || !hasApprovedAccess(other.status))
        throw new ConvexError("Esta pessoa não está disponível.");
      await ctx.db.patch(link._id, { state: "accepted" });
    } else await ctx.db.delete(link._id);
    return null;
  },
});
export const send = mutation({
  args: {
    selection: scriptureSelectionValidator,
    recipientIds: v.array(v.id("users")),
    message: v.string(),
    requestId: v.string(),
  },
  returns: v.id("scriptureShares"),
  handler: async (ctx, args) => {
    const actor = await findUser(ctx),
      input = rule(() => shareInputSchema.parse(args)),
      fingerprint = shareFingerprint(input);
    const existing = await ctx.db
      .query("scriptureShares")
      .withIndex("by_senderId_and_requestId", (q) =>
        q.eq("senderId", actor._id).eq("requestId", input.requestId),
      )
      .unique();
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new ConvexError("Esta tentativa já foi usada para outro recado.");
      return existing._id;
    }
    const recipients = [];
    for (const id of args.recipientIds) {
      const other = await ctx.db.get(id),
        link = await pair(ctx, actor._id, id);
      rule(() =>
        assertFriendRecipient(
          link && { ...link, id: link._id },
          actor._id,
          id,
          !!other && hasApprovedAccess(other.status),
        ),
      );
      recipients.push({ id, name: other!.name });
    }
    const quote = editorialScripture(input.selection);
    const id = await ctx.db.insert("scriptureShares", {
      senderId: actor._id,
      senderName: actor.name,
      requestId: input.requestId,
      fingerprint,
      recipients,
      quote,
      message: input.message,
      sentAt: Date.now(),
    });
    for (const ownerId of [actor._id, ...args.recipientIds]) {
      const location = {
        ownerId,
        direction:
          ownerId === actor._id ? ("sent" as const) : ("received" as const),
        version: quote.version,
        book: quote.book,
        chapter: quote.chapter,
        first: quote.first,
      };
      await ctx.db.insert("shareViews", { ...location, shareId: id });
      const marker = await ctx.db
        .query("shareMarkers")
        .withIndex("by_ownerId_version_book_chapter_first_direction", (q) =>
          q
            .eq("ownerId", ownerId)
            .eq("version", quote.version)
            .eq("book", quote.book)
            .eq("chapter", quote.chapter)
            .eq("first", quote.first)
            .eq("direction", location.direction),
        )
        .unique();
      if (!marker) await ctx.db.insert("shareMarkers", location);
    }
    for (const userId of args.recipientIds) await notify(ctx, { userId, kind: "friendShare", actorName: actor.name, shareId: id, target: { version: quote.version, book: quote.book, chapter: quote.chapter, verse: quote.first }, text: quote.reference, sourceKey: `share:${id}:${userId}` });
    return id;
  },
});
export const shares = query({
  args: {
    direction: v.optional(directionValidator),
    chapter: v.optional(chapterFilterValidator),
    first: v.optional(v.number()),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({
    items: v.array(privateShareValidator),
    nextCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const actor = await findUser(ctx),
      input = shareFilterSchema.parse(args),
      c = input.chapter,
      d = input.direction;
    const base = ctx.db.query("shareViews");
    if (input.first && !c)
      throw new ConvexError("Informe o capítulo da marcação.");
    const rows =
      c && input.first
        ? base.withIndex(
            "by_ownerId_version_book_chapter_first_direction",
            (q) => {
              const range = q
                .eq("ownerId", actor._id)
                .eq("version", c.version)
                .eq("book", c.book)
                .eq("chapter", c.chapter)
                .eq("first", input.first!);
              return d ? range.eq("direction", d) : range;
            },
          )
        : c
          ? d
            ? base.withIndex(
                "by_ownerId_and_version_and_book_and_chapter_and_direction",
                (q) =>
                  q
                    .eq("ownerId", actor._id)
                    .eq("version", c.version)
                    .eq("book", c.book)
                    .eq("chapter", c.chapter)
                    .eq("direction", d),
              )
            : base.withIndex(
                "by_ownerId_and_version_and_book_and_chapter",
                (q) =>
                  q
                    .eq("ownerId", actor._id)
                    .eq("version", c.version)
                    .eq("book", c.book)
                    .eq("chapter", c.chapter),
              )
          : d
            ? base.withIndex("by_ownerId_and_direction", (q) =>
                q.eq("ownerId", actor._id).eq("direction", d),
              )
            : base.withIndex("by_ownerId", (q) => q.eq("ownerId", actor._id));
    const page = await rows
      .order("desc")
      .paginate({ cursor: input.cursor, numItems: 30 });
    const items = [];
    for (const view of page.page) {
      const share = await ctx.db.get(view.shareId);
      if (!share) continue;
      const { recipients, ...item } = privateShare(
        { ...share, id: share._id },
        actor._id,
      );
      items.push({
        ...item,
        id: share._id,
        ...(recipients ? { recipients: share.recipients } : {}),
      });
    }
    return { items, nextCursor: page.isDone ? null : page.continueCursor };
  },
});
export const markers = query({
  args: chapterFilterValidator.fields,
  returns: v.array(
    v.object({ first: v.number(), direction: directionValidator }),
  ),
  handler: async (ctx, args) => {
    const actor = await findUser(ctx),
      c = shareFilterSchema.parse({ chapter: args, cursor: null }).chapter!;
    // At most 176 verse starts × two directions. No message bodies or recipient lists.
    const rows = await ctx.db
      .query("shareMarkers")
      .withIndex("by_ownerId_version_book_chapter_first_direction", (q) =>
        q
          .eq("ownerId", actor._id)
          .eq("version", c.version)
          .eq("book", c.book)
          .eq("chapter", c.chapter),
      )
      .take(352);
    return rows.map(({ first, direction }) => ({ first, direction }));
  },
});
