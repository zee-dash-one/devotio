import { ConvexError, v } from "convex/values";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import type { ComponentApi } from "@convex-dev/rate-limiter/_generated/component.js";
import { componentsGeneric } from "convex/server";
import { emailCodeAttempts, emailLoginLimit } from "domain/core";
import { internalMutation, query } from "./_generated/server";
import { gmailCredentials } from "./mailDelivery";

const components = componentsGeneric() as unknown as { rateLimiter: ComponentApi };
const limiter = new RateLimiter(components.rateLimiter, {
  emailCode: { kind: "token bucket", rate: emailLoginLimit.requests, period: emailLoginLimit.perMinutes * MINUTE, capacity: emailLoginLimit.requests },
  emailAttempt: { kind: "token bucket", rate: emailCodeAttempts, period: emailLoginLimit.perMinutes * MINUTE, capacity: emailCodeAttempts },
  emailCodeDaily: { kind: "token bucket", rate: emailLoginLimit.perDay, period: 24 * 60 * MINUTE, capacity: emailLoginLimit.perDay },
  emailCodeGlobal: { kind: "token bucket", rate: 200, period: 60 * MINUTE, capacity: 200 },
});

/** Limits code requests per address and overall, so the Gmail quota cannot be drained. */
export const consume = internalMutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const global = await limiter.limit(ctx, "emailCodeGlobal");
    const key = args.email.trim().toLowerCase();
    const own = await limiter.limit(ctx, "emailCode", { key });
    const daily = await limiter.limit(ctx, "emailCodeDaily", { key });
    if (!global.ok || !own.ok || !daily.ok) throw new ConvexError("Muitos pedidos de código. Aguarde alguns minutos e tente de novo.");
    // A fresh code starts a fresh budget of guesses (Better Auth does not count them here).
    await limiter.reset(ctx, "emailAttempt", { key });
    return null;
  },
});

/**
 * Counts one guess at the code. Better Auth keeps an attempts counter, but with
 * the Convex adapter it stays at zero, so this is the real brake on guessing.
 */
export const attempt = internalMutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const result = await limiter.limit(ctx, "emailAttempt", { key: args.email.trim().toLowerCase() });
    if (!result.ok) throw new ConvexError("Muitas tentativas. Peça um novo código.");
    return null;
  },
});

/** Public on purpose: it only says whether mail can be sent, never why or from where. */
export const available = query({
  args: {},
  returns: v.boolean(),
  handler: async () => gmailCredentials(process.env) !== null,
});
