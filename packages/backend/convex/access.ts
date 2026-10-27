import { ConvexError } from "convex/values";
import { canManage, hasApprovedAccess, initialAccess } from "domain/core";
import { authComponent } from "./auth";
import { env } from "./_generated/server";
import type { QueryCtx, MutationCtx, Id } from "./server";
export async function identity(ctx: QueryCtx) {
  const session = await ctx.auth.getUserIdentity();
  if (!session) throw new ConvexError("Entre na sua conta para continuar.");
  return session;
}
export async function lookupUser(ctx: QueryCtx) {
  const session = await identity(ctx);
  const canonical = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", session.tokenIdentifier),
    )
    .unique();
  if (canonical) return canonical;
  const legacy = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", session.subject))
    .unique();
  return legacy &&
    (!legacy.tokenIdentifier ||
      legacy.tokenIdentifier === session.tokenIdentifier)
    ? legacy
    : null;
}
export async function findUser(ctx: QueryCtx) {
  const user = await lookupUser(ctx);
  if (!user || !hasApprovedAccess(user.status))
    throw new ConvexError(
      "Seu acesso ainda não foi aprovado ou está desativado.",
    );
  return user;
}
export async function registerUser(ctx: MutationCtx) {
  const session = await identity(ctx);
  const existing = await lookupUser(ctx);
  if (existing) {
    const patch = {
      tokenIdentifier: session.tokenIdentifier,
      normalizedEmail: existing.email.trim().toLowerCase(),
      normalizedName: existing.name.trim().toLowerCase(),
      status: existing.status ?? ("approved" as const),
    };
    await ctx.db.patch(existing._id, patch);
    return { ...existing, ...patch };
  }
  const authUser = await authComponent.getAuthUser(ctx);
  const email = authUser.email.trim().toLowerCase();
  const reserved = await ctx.db
    .query("users")
    .withIndex("by_normalizedEmail", (q) => q.eq("normalizedEmail", email))
    .unique();
  if (reserved) {
    if (reserved.authId || !authUser.emailVerified)
      throw new ConvexError(
        "Não foi possível vincular este cadastro. Procure o responsável.",
      );
    await ctx.db.patch(reserved._id, {
      authId: session.subject,
      tokenIdentifier: session.tokenIdentifier,
    });
    return {
      ...reserved,
      authId: session.subject,
      tokenIdentifier: session.tokenIdentifier,
    };
  }
  const settings = await ctx.db
    .query("accessSettings")
    .withIndex("by_key", (q) => q.eq("key", "main"))
    .unique();
  const cutoff = Date.parse(env.PILOT_EXISTING_USERS_BEFORE ?? "");
  const status = initialAccess(
    settings?.approvalRequired ?? true,
    Number.isFinite(cutoff) && authUser.createdAt < cutoff,
  );
  const id = await ctx.db.insert("users", {
    authId: session.subject,
    tokenIdentifier: session.tokenIdentifier,
    name: authUser.name || "Leitor",
    normalizedName: (authUser.name || "Leitor").trim().toLowerCase(),
    email,
    normalizedEmail: email,
    status,
    editorial: false,
  });
  const user = await ctx.db.get(id);
  if (!user) throw new ConvexError("Não foi possível criar sua conta.");
  return user;
}
export async function ensureUser(ctx: MutationCtx) {
  const user = await registerUser(ctx);
  if (!hasApprovedAccess(user.status))
    throw new ConvexError(
      "Seu acesso ainda não foi aprovado ou está desativado.",
    );
  return user;
}
export async function membership(
  ctx: QueryCtx,
  id: Id<"communities">,
  admin = false,
) {
  const user = await findUser(ctx);
  if (!user) throw new ConvexError("Você não tem acesso a esta comunidade.");
  const member = await ctx.db
    .query("communityMembers")
    .withIndex("by_pair", (q) => q.eq("communityId", id).eq("userId", user._id))
    .unique();
  if (!member || (admin && !canManage(member.role)))
    throw new ConvexError("Você não tem acesso a esta ação na comunidade.");
  return { user, member };
}
