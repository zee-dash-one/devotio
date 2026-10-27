import { ConvexError, v } from "convex/values";
import {
  effectiveAccess,
  hasApprovedAccess,
  managedUserSchema,
  updateManagedUserSchema,
  adminListSchema,
  communityPermissionSchema,
  communityCreationSchema,
  canManage,
} from "domain/core";
import { mutation, env } from "./_generated/server";
import type { MutationCtx, Id } from "./server";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin } from "./adminSession";
import { statusValidator } from "./users";
import { creationPermission, transferOwner, addMember } from "./communityGovernance";
import { notifyRemoval } from "./notifications";
import { creationValidator } from "./communityValidators";

const userValidator = v.object({
  id: v.id("users"),
  name: v.string(),
  email: v.string(),
  status: statusValidator,
  editorial: v.boolean(),
  linked: v.boolean(),
  communityCreation: creationValidator,
});
async function present(ctx: MutationCtx, user: Doc<"users">) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    status: effectiveAccess(user.status),
    editorial: user.editorial === true,
    linked: !!user.authId,
    communityCreation: await creationPermission(ctx, user),
  };
}
async function audit(ctx: MutationCtx, target: string, action: string) {
  await ctx.db.insert("userAdminEvents", {
    actor: env.ADMIN_LOGIN!,
    target,
    action,
    at: Date.now(),
  });
}
// A transfer must precede disabling/demoting a community's last active admin.
async function protectLastAdmin(
  ctx: MutationCtx,
  communityId: Id<"communities">,
  userId: Id<"users">,
) {
  for await (const member of ctx.db
    .query("communityMembers")
    .withIndex("by_community", (q) => q.eq("communityId", communityId))) {
    if (member.userId === userId || !canManage(member.role)) continue;
    const other = await ctx.db.get(member.userId);
    if (other && hasApprovedAccess(other.status)) return;
  }
  throw new ConvexError(
    "Conceda administração a outra pessoa aprovada nesta comunidade antes de continuar.",
  );
}
export const list = mutation({
  args: {
    token: v.string(),
    cursor: v.union(v.string(), v.null()),
    search: v.string(),
    field: v.union(v.literal("name"), v.literal("email")),
    status: v.optional(statusValidator),
  },
  returns: v.object({
    users: v.array(userValidator),
    cursor: v.union(v.string(), v.null()),
    approvalRequired: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const input = adminListSchema.parse(args);
    const from = input.search,
      to = input.search + "\uffff";
    const base = ctx.db.query("users");
    const query =
      input.field === "name"
        ? input.status
          ? base.withIndex("by_status_and_normalizedName", (q) =>
              q
                .eq("status", input.status)
                .gte("normalizedName", from)
                .lte("normalizedName", to),
            )
          : base.withIndex("by_normalizedName", (q) =>
              q.gte("normalizedName", from).lte("normalizedName", to),
            )
        : input.status
          ? base.withIndex("by_status_and_normalizedEmail", (q) =>
              q
                .eq("status", input.status)
                .gte("normalizedEmail", from)
                .lte("normalizedEmail", to),
            )
          : base.withIndex("by_normalizedEmail", (q) =>
              q.gte("normalizedEmail", from).lte("normalizedEmail", to),
            );
    const page = await query.paginate({ cursor: input.cursor, numItems: 25 });
    const settings = await ctx.db
      .query("accessSettings")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    return {
      users: await Promise.all(page.page.map(user => present(ctx, user))),
      cursor: page.isDone ? null : page.continueCursor,
      approvalRequired: settings?.approvalRequired ?? true,
    };
  },
});
export const create = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    email: v.string(),
    status: statusValidator,
    editorial: v.boolean(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const input = managedUserSchema.parse(args);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_normalizedEmail", (q) =>
        q.eq("normalizedEmail", input.email),
      )
      .unique();
    if (existing) {
      if (
        existing.name === input.name &&
        effectiveAccess(existing.status) === input.status &&
        !!existing.editorial === input.editorial
      )
        return existing._id;
      throw new ConvexError(
        "Já existe um cadastro com este e-mail. Edite o cadastro existente.",
      );
    }
    const id = await ctx.db.insert("users", {
      ...input,
      normalizedEmail: input.email,
      normalizedName: input.name.toLowerCase(),
    });
    await audit(ctx, id, "create");
    return id;
  },
});
export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("users"),
    name: v.string(),
    status: statusValidator,
    editorial: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const input = updateManagedUserSchema.parse(args);
    const current = await ctx.db.get(args.id);
    if (!current) throw new ConvexError("Cadastro não encontrado.");
    if (input.status !== "approved" && (await ctx.db.query("communities").withIndex("by_ownerId", q => q.eq("ownerId", args.id)).first())) throw new ConvexError("Transfira a posse das comunidades antes de desativar o responsável.");
    if (hasApprovedAccess(current.status) && input.status !== "approved") {
      for await (const member of ctx.db
        .query("communityMembers")
        .withIndex("by_user", (q) => q.eq("userId", args.id))) {
        if (member.role === "owner") throw new ConvexError("Transfira a posse antes de desativar o responsável.");
        if (canManage(member.role))
          await protectLastAdmin(ctx, member.communityId, args.id);
      }
    }
    await ctx.db.patch(args.id, {
      name: input.name,
      normalizedName: input.name.toLowerCase(),
      status: input.status,
      editorial: input.editorial,
    });
    await audit(
      ctx,
      args.id,
      `update:${effectiveAccess(current.status)}->${input.status};editorial:${!!current.editorial}->${input.editorial}`,
    );
    return null;
  },
});
export const setApproval = mutation({
  args: { token: v.string(), required: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const current = await ctx.db
      .query("accessSettings")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    if (current)
      await ctx.db.patch(current._id, { approvalRequired: args.required });
    else
      await ctx.db.insert("accessSettings", {
        key: "main",
        approvalRequired: args.required,
      });
    await audit(ctx, "pilot", `approvalRequired:${args.required}`);
    return null;
  },
});
export const communities = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({
    communities: v.array(
      v.object({
        id: v.id("communities"),
        name: v.string(),
        role: v.union(
          v.literal("admin"),
          v.literal("owner"),
          v.literal("member"),
          v.literal("none"),
        ),
      }),
    ),
    cursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    if (!(await ctx.db.get(args.userId)))
      throw new ConvexError("Cadastro não encontrado.");
    const page = await ctx.db
      .query("communities")
      .paginate({ cursor: args.cursor, numItems: 25 });
    return {
      communities: await Promise.all(
        page.page.map(async (c) => {
          const member = await ctx.db
            .query("communityMembers")
            .withIndex("by_pair", (q) =>
              q.eq("communityId", c._id).eq("userId", args.userId),
            )
            .unique();
          return {
            id: c._id,
            name: c.name,
            role: member?.role ?? ("none" as const),
          };
        }),
      ),
      cursor: page.isDone ? null : page.continueCursor,
    };
  },
});
export const setCommunity = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    communityId: v.id("communities"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member"), v.literal("none")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    communityPermissionSchema.parse(args);
    const user = await ctx.db.get(args.userId),
      community = await ctx.db.get(args.communityId);
    if (!user || !community)
      throw new ConvexError("Cadastro ou comunidade não encontrado.");
    if ((args.role === "admin" || args.role === "owner") && !hasApprovedAccess(user.status))
      throw new ConvexError("Aprove o acesso antes de conceder administração.");
    const member = await ctx.db
      .query("communityMembers")
      .withIndex("by_pair", (q) =>
        q.eq("communityId", args.communityId).eq("userId", args.userId),
      )
      .unique();
    if (args.role === "owner") {
      if (!member) throw new ConvexError("Adicione a pessoa à comunidade antes de transferir a posse.");
      await transferOwner(ctx, args.communityId, member._id);
      await audit(ctx, args.userId, `community:${args.communityId}:owner`);
      return null;
    }
    if (member?.role === "owner" || community.ownerId === args.userId) throw new ConvexError("Transfira a posse antes de alterar ou remover o responsável.");
    if (member?.role === "admin" && args.role !== "admin")
      await protectLastAdmin(ctx, args.communityId, args.userId);
    if (args.role === "none") {
      if (member) {
        await ctx.db.delete(member._id);
        await notifyRemoval(ctx, member, community.name);
      }
    } else if (member) await ctx.db.patch(member._id, { role: args.role });
    else
      await addMember(ctx, args.communityId, args.userId, args.role);
    await audit(ctx, args.userId, `community:${args.communityId}:${args.role}`);
    return null;
  },
});
export const setCommunityCreation = mutation({
  args: { token: v.string(), userId: v.id("users"), allowed: v.boolean(), limit: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const input = communityCreationSchema.parse(args);
    if (!(await ctx.db.get(args.userId))) throw new ConvexError("Cadastro não encontrado.");
    await ctx.db.patch(args.userId, { communityCreationAllowed: input.allowed, communityCreationLimit: input.limit });
    await audit(ctx, args.userId, `community-creation:${input.allowed}:${input.limit}`);
    return null;
  },
});
