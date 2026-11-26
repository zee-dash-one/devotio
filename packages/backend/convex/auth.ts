import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import type { ComponentApi } from "@convex-dev/better-auth/_generated/component.js";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { componentsGeneric, makeFunctionReference } from "convex/server";
import { emailOTP } from "better-auth/plugins/email-otp";
import { emailCodeAttempts, emailCodeLength, emailCodeLifetimeSeconds } from "domain/core";
import { deliverEmailCode, guardCodeAttempt, type MailPorts } from "./mailDelivery";
import { betterAuth } from "better-auth/minimal";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { DataModel } from "./server";
import authConfig from "./auth.config";
const components = componentsGeneric() as unknown as {
  betterAuth: ComponentApi;
};
export const authComponent = createClient<DataModel>(components.betterAuth);
/** In production mail goes through Convex functions; tests inject their own ports. */
function convexMailPorts(ctx: GenericCtx<DataModel>): MailPorts | null {
  if (!("runAction" in ctx)) return null;
  return {
    limit: async (email) => { await ctx.runMutation(makeFunctionReference<"mutation">("mail:consume"), { email }); },
    send: async (message) => { await ctx.runAction(makeFunctionReference<"action">("mailNode:send"), message); },
    attempt: async (email) => { await ctx.runMutation(makeFunctionReference<"mutation">("mail:attempt"), { email }); },
    log: (line) => console.info(line),
  };
}
export const createAuth = (ctx: GenericCtx<DataModel>, mail: MailPorts | null = convexMailPorts(ctx)) => {
  const siteUrl = process.env.SITE_URL;
  if (
    !siteUrl ||
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.BETTER_AUTH_SECRET
  )
    throw new Error(
      "Configure SITE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e BETTER_AUTH_SECRET no Convex.",
    );
  return betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path !== "/sign-in/email-otp" || !mail) return;
        try { await guardCodeAttempt(mail, (context.body as { email?: unknown } | undefined)?.email); }
        catch { throw new APIError("TOO_MANY_REQUESTS", { code: "TOO_MANY_ATTEMPTS", message: "Muitas tentativas. Peça um novo código." }); }
      }),
    },
    plugins: [
      crossDomain({ siteUrl }),
      convex({ authConfig }),
      emailOTP({
        otpLength: emailCodeLength,
        expiresIn: emailCodeLifetimeSeconds,
        allowedAttempts: emailCodeAttempts,
        storeOTP: "hashed",
        sendVerificationOTP: async (data) => {
          if (mail) await deliverEmailCode(mail, data);
        },
      }),
    ],
  });
};
