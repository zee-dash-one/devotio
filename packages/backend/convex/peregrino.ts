import { ConvexError, v } from "convex/values";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import type { ComponentApi } from "@convex-dev/rate-limiter/_generated/component.js";
import { componentsGeneric, makeFunctionReference } from "convex/server";
import {
  openRouterKeySchema, peregrinoErrorMessage, peregrinoMissingKey, peregrinoModel, peregrinoRateLimit, peregrinoTargetSchema, runPeregrinoPipeline,
} from "domain/core";
import { action, internalMutation, internalQuery, mutation, query, env } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./server";
import { findUser } from "./access";
import { editorialScripture } from "./scriptures";
import { scriptureSelectionValidator } from "./scriptureValidators";

const components = componentsGeneric() as unknown as { rateLimiter: ComponentApi };
const limiter = new RateLimiter(components.rateLimiter, {
  peregrino: { kind: "token bucket", rate: 10, period: 10 * MINUTE, capacity: 10 },
});

async function requireWriter(ctx: QueryCtx) {
  const user = await findUser(ctx);
  if (user.superuser !== true && user.editorial !== true) throw new ConvexError("Acesso exclusivo da gestão editorial.");
  return user;
}
async function requireSystem(ctx: QueryCtx) {
  const user = await findUser(ctx);
  if (user.superuser !== true) throw new ConvexError("Acesso exclusivo de superusuários.");
  return user;
}
function encode(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}
function decode(value: string) {
  const text = atob(value);
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}
async function masterKey() {
  if (!env.INTEGRATION_ENCRYPTION_KEY) throw new ConvexError("A configuração de segurança do servidor está incompleta. Procure o responsável pelo piloto.");
  const raw = decode(env.INTEGRATION_ENCRYPTION_KEY);
  if (raw.length !== 32) throw new ConvexError("A configuração de segurança do servidor está incompleta. Procure o responsável pelo piloto.");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function seal(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await masterKey(), new TextEncoder().encode(value));
  return { ciphertext: encode(new Uint8Array(cipher)), iv: encode(iv) };
}
async function open(ciphertext: string, iv: string) {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(iv) }, await masterKey(), decode(ciphertext));
  return new TextDecoder().decode(plain);
}

export const keyStatus = query({
  args: {},
  returns: v.object({ configured: v.boolean() }),
  handler: async (ctx) => {
    await requireSystem(ctx);
    const row = await ctx.db.query("integrationSecrets").withIndex("by_provider", (q) => q.eq("provider", "openrouter")).unique();
    return { configured: !!row };
  },
});
export const status = query({
  args: {},
  returns: v.object({ configured: v.boolean(), model: v.string() }),
  handler: async (ctx) => {
    await requireWriter(ctx);
    const row = await ctx.db.query("integrationSecrets").withIndex("by_provider", (q) => q.eq("provider", "openrouter")).unique();
    return { configured: !!row, model: peregrinoModel };
  },
});
export const setKey = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireSystem(ctx);
    const key = openRouterKeySchema.parse(args.key);
    const sealed = await seal(key);
    const current = await ctx.db.query("integrationSecrets").withIndex("by_provider", (q) => q.eq("provider", "openrouter")).unique();
    const value = { provider: "openrouter" as const, ...sealed, updatedAt: Date.now(), updatedBy: actor._id };
    if (current) await ctx.db.replace(current._id, value);
    else await ctx.db.insert("integrationSecrets", value);
    return null;
  },
});
export const clearKey = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireSystem(ctx);
    const current = await ctx.db.query("integrationSecrets").withIndex("by_provider", (q) => q.eq("provider", "openrouter")).unique();
    if (current) await ctx.db.delete(current._id);
    return null;
  },
});
export const consume = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx: MutationCtx) => {
    const user = await requireWriter(ctx);
    const result = await limiter.limit(ctx, "peregrino", { key: user._id });
    if (!result.ok) throw new ConvexError(peregrinoRateLimit);
    return null;
  },
});
export const prepare = internalQuery({
  args: {
    selection: v.optional(scriptureSelectionValidator),
    date: v.optional(v.string()),
    reflection: v.optional(v.string()),
    prayerSuggestion: v.optional(v.string()),
    focus: v.optional(v.string()),
    target: v.union(v.literal("both"), v.literal("reflection"), v.literal("prayer")),
  },
  returns: v.object({
    reference: v.string(), scripture: v.string(), reflection: v.optional(v.string()), prayerSuggestion: v.optional(v.string()), focus: v.optional(v.string()), target: v.string(), ciphertext: v.string(), iv: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireWriter(ctx);
    const secret = await ctx.db.query("integrationSecrets").withIndex("by_provider", (q) => q.eq("provider", "openrouter")).unique();
    if (!secret) throw new ConvexError(peregrinoMissingKey);
    let reference = "";
    let scripture = "";
    if (args.selection) {
      const quote = editorialScripture(args.selection);
      reference = quote.reference;
      scripture = quote.text;
    } else if (args.date) {
      const day = await ctx.db.query("devotionals").withIndex("by_date", (q) => q.eq("date", args.date!)).unique();
      if (!day) throw new ConvexError("Devocional não encontrado.");
      reference = day.reference;
      scripture = day.scripture;
    } else throw new ConvexError("Escolha o trecho bíblico antes de pedir auxílio.");
    return { reference, scripture, reflection: args.reflection, prayerSuggestion: args.prayerSuggestion, focus: args.focus, target: args.target, ciphertext: secret.ciphertext, iv: secret.iv };
  },
});

async function complete(key: string, messages: { role: "system" | "user"; content: string }[]) {
  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Devotio" },
      body: JSON.stringify({ model: peregrinoModel, max_tokens: 700, temperature: 0.6, messages }),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new ConvexError("O Peregrino não respondeu a tempo. Tente novamente em instantes.");
  }
  if (!response.ok) throw new ConvexError(peregrinoErrorMessage(response.status));
  const body = await response.json() as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new ConvexError("O Peregrino devolveu uma resposta inesperada. Tente novamente.");
  return content;
}

export const suggest = action({
  args: {
    selection: v.optional(scriptureSelectionValidator),
    date: v.optional(v.string()),
    reflection: v.optional(v.string()),
    prayerSuggestion: v.optional(v.string()),
    focus: v.optional(v.string()),
    target: v.union(v.literal("both"), v.literal("reflection"), v.literal("prayer")),
  },
  returns: v.object({ reflection: v.optional(v.string()), prayerSuggestion: v.optional(v.string()), model: v.string() }),
  handler: async (ctx, args) => {
    await ctx.runMutation(makeFunctionReference<"mutation">("peregrino:consume"), {});
    const prepared = await ctx.runQuery(makeFunctionReference<"query", typeof args, {
      reference: string; scripture: string; reflection?: string; prayerSuggestion?: string; focus?: string; target: string; ciphertext: string; iv: string;
    }>("peregrino:prepare"), args);
    const target = peregrinoTargetSchema.parse(prepared.target);
    const key = await open(prepared.ciphertext, prepared.iv);
    return await runPeregrinoPipeline((messages) => complete(key, messages), { reference: prepared.reference, scripture: prepared.scripture, focus: prepared.focus, target });
  },
});
