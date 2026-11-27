import { emailCodeMessage } from "domain/core";

export interface MailMessage { to: string; subject: string; text: string; html: string }
export interface MailPorts {
  /** Throws when the address or the whole app asked for too many codes. */
  limit(email: string): Promise<void>;
  send(message: MailMessage): Promise<void>;
  /** Counts one guess at the code; throws once the budget for this code is spent. */
  attempt(email: string): Promise<void>;
  log(line: string): void;
}

/** "ana@example.com" -> "a***@example.com": enough to trace a report, not enough to identify. */
export function maskEmail(email: string) {
  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, 1)}***@${domain}`;
}

/**
 * Turns a transport failure into a short reason. It never echoes the raw
 * message, which can carry the account name or other secrets.
 */
export function describeMailFailure(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  if (code === "EAUTH") return "credenciais recusadas pelo Gmail";
  if (code === "ECONNECTION" || code === "ETIMEDOUT" || code === "ESOCKET" || code === "ECONNREFUSED" || code === "EDNS") return "sem conexão com o Gmail";
  if (code === "EENVELOPE") return "endereço recusado";
  if (error instanceof Error && error.name === "ConvexError") return "e-mail não configurado";
  return "erro desconhecido";
}

/**
 * Google shows an app password as "abcd efgh ijkl mnop". Pasting it with the
 * spaces, or with a stray newline, is the usual reason Gmail refuses a valid one.
 */
export function gmailCredentials(env: { GMAIL_USER?: string; GMAIL_APP_PASSWORD?: string }) {
  const user = (env.GMAIL_USER ?? "").trim();
  const pass = (env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");
  return user && pass ? { user, pass } : null;
}

export function gmailTransportOptions(user: string, pass: string) {
  return { host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 } as const;
}

/**
 * Only sign-in codes are mailed. The limit runs first, so a blocked address
 * never reaches the mail provider, and failures are logged without the code.
 */
export async function deliverEmailCode(ports: MailPorts, data: { email: string; otp: string; type: string }) {
  if (data.type !== "sign-in") return;
  const email = data.email.trim().toLowerCase();
  try {
    await ports.limit(email);
  } catch (error) {
    ports.log(`[email] pedido bloqueado pelo limite: ${maskEmail(email)}`);
    throw error;
  }
  try {
    await ports.send({ to: email, ...emailCodeMessage(data.otp) });
  } catch (error) {
    ports.log(`[email] falha no envio para ${maskEmail(email)}: ${describeMailFailure(error)}`);
    throw error;
  }
  ports.log(`[email] código enviado para ${maskEmail(email)}`);
}

/** Runs before a code is checked. A blocked address gets no further guesses. */
export async function guardCodeAttempt(ports: MailPorts, rawEmail: unknown) {
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!email) return;
  try {
    await ports.attempt(email);
  } catch (error) {
    ports.log(`[email] tentativas esgotadas: ${maskEmail(email)}`);
    throw error;
  }
}
