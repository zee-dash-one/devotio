import { ConvexError, v } from "convex/values";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import type { ComponentApi } from "@convex-dev/rate-limiter/_generated/component.js";
import { componentsGeneric } from "convex/server";
import { emailLoginLimit } from "domain/core";
import { internalMutation } from "./_generated/server";

const components = componentsGeneric() as unknown as { rateLimiter: ComponentApi };
const limiter = new RateLimiter(components.rateLimiter, {
  emailCode: { kind: "token bucket", rate: emailLoginLimit.requests, period: emailLoginLimit.perMinutes * MINUTE, capacity: emailLoginLimit.requests },
  emailCodeGlobal: { kind: "token bucket", rate: 200, period: 60 * MINUTE, capacity: 200 },
});

/** Limits code requests per address and overall, so the Gmail quota cannot be drained. */
export const consume = internalMutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const global = await limiter.limit(ctx, "emailCodeGlobal");
    const own = await limiter.limit(ctx, "emailCode", { key: args.email.trim().toLowerCase() });
    if (!global.ok || !own.ok) throw new ConvexError("Muitos pedidos de código. Aguarde alguns minutos e tente de novo.");
    return null;
  },
});
