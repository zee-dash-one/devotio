import { ConvexError, v } from "convex/values";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import type { ComponentApi } from "@convex-dev/rate-limiter/_generated/component.js";
import { componentsGeneric, makeFunctionReference } from "convex/server";
import { internalMutation, mutation, env } from "./_generated/server";
import type { MutationCtx } from "./server";

export async function digest(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function credentialVersion() {
  if (!env.ADMIN_LOGIN || !env.ADMIN_PASSWORD_HASH || !env.ADMIN_TOTP_SECRET)
    throw new ConvexError(
      "A entrada administrativa ainda não está configurada.",
    );
  return digest(
    JSON.stringify([
      env.ADMIN_LOGIN,
      env.ADMIN_PASSWORD_HASH,
      env.ADMIN_TOTP_SECRET,
    ]),
  );
}
export async function requireAdmin(ctx: MutationCtx, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new ConvexError("Entre novamente no painel.");
  // Hash tokens before querying; no bearer credentials are stored in the database.
  const tokenHash = await digest(token);
  const active = await ctx.db
    .query("adminSessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (
    !active ||
    active.expiresAt <= Date.now() ||
    active.credentialVersion !== (await credentialVersion())
  )
    throw new ConvexError("Sessão administrativa expirada. Entre novamente.");
  return active;
}
const components = componentsGeneric() as unknown as {
  rateLimiter: ComponentApi;
};
const limiter = new RateLimiter(components.rateLimiter, {
  adminLogin: {
    kind: "token bucket",
    rate: 5,
    period: 5 * MINUTE,
    capacity: 5,
  },
});
// Called by an action so failed authentication cannot roll back consumed attempts.
export const consumeAttempt = internalMutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => (await limiter.limit(ctx, "adminLogin")).ok,
});
export const issue = internalMutation({
  args: { tokenHash: v.string(), counter: v.number(), version: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    if (args.version !== (await credentialVersion()))
      throw new ConvexError("A configuração mudou. Entre novamente.");
    const current = await ctx.db
      .query("adminSecurity")
      .withIndex("by_key", (q) => q.eq("key", "owner"))
      .unique();
    if (
      current?.credentialVersion === args.version &&
      args.counter <= current.lastTotpCounter
    )
      throw new ConvexError(
        "Código já utilizado. Aguarde o próximo código do autenticador.",
      );
    const security = {
      key: "owner" as const,
      lastTotpCounter: args.counter,
      credentialVersion: args.version,
    };
    if (current) await ctx.db.patch(current._id, security);
    else await ctx.db.insert("adminSecurity", security);
    const expiresAt = Date.now() + 30 * MINUTE;
    const id = await ctx.db.insert("adminSessions", {
      tokenHash: args.tokenHash,
      credentialVersion: args.version,
      expiresAt,
    });
    await ctx.scheduler.runAt(
      expiresAt,
      makeFunctionReference<"mutation">("adminSession:expire"),
      { id },
    );
    return expiresAt;
  },
});
export const expire = internalMutation({
  args: { id: v.id("adminSessions") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    if (await ctx.db.get(id)) await ctx.db.delete(id);
    return null;
  },
});
export const logout = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const tokenHash = await digest(token);
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (session) await ctx.db.delete(session._id);
    return null;
  },
});
