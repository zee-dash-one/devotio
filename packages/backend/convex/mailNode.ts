"use node";
import { ConvexError, v } from "convex/values";
import nodemailer from "nodemailer";
import { internalAction } from "./_generated/server";

/**
 * Sends one message through Gmail SMTP. It needs a Google account with 2-step
 * verification and an app password. Swap this file for an HTTP provider (such as
 * Resend) once the project owns a domain; callers only know `mailNode:send`.
 */
export const send = internalAction({
  args: { to: v.string(), subject: v.string(), text: v.string(), html: v.string() },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) throw new ConvexError("A entrada por e-mail ainda não foi configurada. Procure o responsável.");
    const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
    await transport.sendMail({ from: `Devotio <${user}>`, to: args.to, subject: args.subject, text: args.text, html: args.html });
    return null;
  },
});
