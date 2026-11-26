import { randomInt } from "node:crypto";
import { emailCodeAttempts, emailCodeLength, emailCodeLifetimeSeconds, emailLoginLimit } from "../../domain/index";
import { LocalError } from "./database.local";

interface Pending { code: string; expiresAt: number; attempts: number }

/**
 * Local stand-in for the connected e-mail code login. No mail is sent: the code
 * is returned to the page and printed in the terminal. Rules match production:
 * 6 digits, 5 minutes, 3 attempts, and a request limit per address.
 */
export class LocalEmailLogin {
  private readonly codes = new Map<string, Pending>();
  private readonly requests = new Map<string, number[]>();
  constructor(private readonly now: () => number = Date.now, private readonly log: (message: string) => void = message => console.info(message)) {}

  request(email: string) {
    const at = this.now();
    const recent = (this.requests.get(email) ?? []).filter(time => at - time < emailLoginLimit.perMinutes * 60_000);
    const today = (this.requests.get(email) ?? []).filter(time => at - time < 24 * 60 * 60_000);
    if (recent.length >= emailLoginLimit.requests || today.length >= emailLoginLimit.perDay) throw new LocalError("Muitos pedidos de código. Aguarde alguns minutos e tente de novo.", 429);
    this.requests.set(email, [...today, at]);
    const code = String(randomInt(0, 10 ** emailCodeLength)).padStart(emailCodeLength, "0");
    this.codes.set(email, { code, expiresAt: at + emailCodeLifetimeSeconds * 1000, attempts: 0 });
    this.log(`[email local] código de ${email}: ${code}`);
    return { devCode: code };
  }

  /** Consumes the code once; the caller then signs the person in. */
  verify(email: string, code: string) {
    const pending = this.codes.get(email);
    if (!pending || pending.expiresAt <= this.now()) { this.codes.delete(email); throw new LocalError("Código inválido ou expirado. Peça um novo.", 400); }
    pending.attempts += 1;
    if (pending.code !== code) {
      if (pending.attempts >= emailCodeAttempts) this.codes.delete(email);
      throw new LocalError("Código inválido ou expirado. Peça um novo.", 400);
    }
    this.codes.delete(email);
  }
}
