import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import type { ComponentApi } from "@convex-dev/better-auth/_generated/component.js";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { componentsGeneric, makeFunctionReference } from "convex/server";
import { emailOTP } from "better-auth/plugins/email-otp";
import { emailCodeAttempts, emailCodeLength, emailCodeLifetimeSeconds, emailCodeMessage } from "domain/core";
import { betterAuth } from "better-auth/minimal";
import type { DataModel } from "./server";
import authConfig from "./auth.config";
const components = componentsGeneric() as unknown as {
  betterAuth: ComponentApi;
};
export const authComponent = createClient<DataModel>(components.betterAuth);
export const createAuth = (ctx: GenericCtx<DataModel>) => {
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
    plugins: [
      crossDomain({ siteUrl }),
      convex({ authConfig }),
      emailOTP({
        otpLength: emailCodeLength,
        expiresIn: emailCodeLifetimeSeconds,
        allowedAttempts: emailCodeAttempts,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type !== "sign-in" || !("runAction" in ctx)) return;
          await ctx.runMutation(makeFunctionReference<"mutation">("mail:consume"), { email });
          await ctx.runAction(makeFunctionReference<"action">("mailNode:send"), { to: email, ...emailCodeMessage(otp) });
        },
      }),
    ],
  });
};
