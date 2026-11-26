import { describe, expect, it } from "vitest";
import { emailLoginError } from "./email-login-error";

describe("email login errors", () => {
  it("explains a wrong, expired or exhausted code in Portuguese", () => {
    expect(emailLoginError({ code: "INVALID_OTP", status: 400 })).toBe("Código inválido ou expirado. Peça um novo.");
    expect(emailLoginError({ code: "OTP_EXPIRED", status: 400 })).toBe("Código inválido ou expirado. Peça um novo.");
    expect(emailLoginError({ code: "TOO_MANY_ATTEMPTS", status: 429 })).toBe("Muitas tentativas. Peça um novo código.");
  });
  it("tells a rate limit from any other failure and never shows raw server text", () => {
    expect(emailLoginError({ status: 429 })).toMatch(/Muitos pedidos de código/);
    const other = emailLoginError({ code: "SOMETHING_ELSE", status: 500 });
    expect(other).toBe("Não foi possível usar o e-mail agora. Tente novamente em instantes.");
    expect(emailLoginError({})).toBe(other);
  });
});
