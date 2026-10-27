"use node";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { verifyPassword } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";
import { ConvexError, v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { adminLoginSchema } from "domain/core";
import { action, env } from "./_generated/server";

export async function matchingCounter(
  secret: string,
  code: string,
  now: number,
) {
  const counter = Math.floor(now / 30000);
  let match: number | null = null;
  for (const offset of [-1, 0, 1]) {
    const expected = await createOTP(secret).hotp(counter + offset);
    if (
      code.length === expected.length &&
      timingSafeEqual(Buffer.from(code), Buffer.from(expected))
    )
      match = counter + offset;
  }
  return match;
}
export const login = action({
  args: { login: v.string(), password: v.string(), code: v.string() },
  returns: v.object({ token: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const allowed: boolean = await ctx.runMutation(
      makeFunctionReference<"mutation", Record<string, never>, boolean>(
        "adminSession:consumeAttempt",
      ),
      {},
    );
    if (!allowed)
      throw new ConvexError(
        "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
      );
    const input = adminLoginSchema.safeParse(args);
    const {
      ADMIN_LOGIN: login,
      ADMIN_PASSWORD_HASH: hash,
      ADMIN_TOTP_SECRET: secret,
    } = env;
    if (!login || !hash || !secret)
      throw new ConvexError(
        "A entrada administrativa ainda não está configurada.",
      );
    if (!input.success)
      throw new ConvexError(
        "Não foi possível entrar. Confira login, senha e código.",
      );
    const passwordValid = await verifyPassword({
      hash,
      password: input.data.password,
    });
    const counter = await matchingCounter(secret, input.data.code, Date.now());
    if (
      input.data.login !== login.trim().toLowerCase() ||
      !passwordValid ||
      counter === null
    )
      throw new ConvexError(
        "Não foi possível entrar. Confira login, senha e código.",
      );
    const { createHash } = await import("node:crypto");
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const version = createHash("sha256")
      .update(JSON.stringify([login, hash, secret]))
      .digest("hex");
    const expiresAt: number = await ctx.runMutation(
      makeFunctionReference<
        "mutation",
        { tokenHash: string; counter: number; version: string },
        number
      >("adminSession:issue"),
      { tokenHash, counter, version },
    );
    return { token, expiresAt };
  },
});
