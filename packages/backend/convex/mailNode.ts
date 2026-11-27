"use node";
import { ConvexError, v } from "convex/values";
import nodemailer from "nodemailer";
import { internalAction } from "./_generated/server";
import { describeMailFailure, gmailCredentials, gmailTransportOptions } from "./mailDelivery";

/**
 * Sends one message through Gmail SMTP. It needs a Google account with 2-step
 * verification and an app password. Swap this file for an HTTP provider (such as
 * Resend) once the project owns a domain; callers only know `mailNode:send`.
 */
function transport() {
  const credentials = gmailCredentials(process.env);
  if (!credentials) throw new ConvexError("A entrada por e-mail ainda não foi configurada. Procure o responsável.");
  return { user: credentials.user, mailer: nodemailer.createTransport(gmailTransportOptions(credentials.user, credentials.pass)) };
}

export const send = internalAction({
  args: { to: v.string(), subject: v.string(), text: v.string(), html: v.string() },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const { user, mailer } = transport();
    try {
      await mailer.sendMail({ from: `Devotio <${user}>`, to: args.to, subject: args.subject, text: args.text, html: args.html });
    } catch (error) {
      // The raw error can name the account; keep only a classified reason.
      throw new ConvexError(`Não foi possível enviar o e-mail (${describeMailFailure(error)}).`);
    }
    return null;
  },
});

/** Logs in to Gmail without sending anything. Run: npx convex run mailNode:check */
export const check = internalAction({
  args: {},
  returns: v.object({ ok: v.boolean(), reason: v.string() }),
  handler: async () => {
    try {
      await transport().mailer.verify();
      return { ok: true, reason: "Login no Gmail aceito." };
    } catch (error) {
      return { ok: false, reason: describeMailFailure(error) };
    }
  },
});
