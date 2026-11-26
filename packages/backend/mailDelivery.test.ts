import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { deliverEmailCode, describeMailFailure, gmailTransportOptions, guardCodeAttempt, maskEmail, type MailMessage } from "./convex/mailDelivery";

function setup(options: { limit?: Error; send?: Error; attempt?: Error } = {}) {
  const sent: MailMessage[] = [];
  const lines: string[] = [];
  const order: string[] = [];
  const ports = {
    limit: async () => { order.push("limit"); if (options.limit) throw options.limit; },
    attempt: async (email: string) => { order.push("attempt:" + email); if (options.attempt) throw options.attempt; },
    send: async (message: MailMessage) => { order.push("send"); if (options.send) throw options.send; sent.push(message); },
    log: (line: string) => { lines.push(line); },
  };
  return { ports, sent, lines, order };
}
const data = { email: "  Ana@Example.COM ", otp: "482913", type: "sign-in" };

describe("email code delivery", () => {
  it("limits first, then mails the code to the normalized address and logs without it", async () => {
    const { ports, sent, lines, order } = setup();
    await deliverEmailCode(ports, data);
    expect(order).toEqual(["limit", "send"]);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("ana@example.com");
    expect(sent[0].text).toContain("482913");
    expect(lines).toEqual(["[email] código enviado para a***@example.com"]);
  });
  it("mails nothing for other flows such as password reset or email change", async () => {
    for (const type of ["email-verification", "forget-password", "change-email"]) {
      const { ports, order } = setup();
      await deliverEmailCode(ports, { ...data, type });
      expect(order).toEqual([]);
    }
  });
  it("never reaches the mail provider when the request limit blocks", async () => {
    const { ports, sent, lines, order } = setup({ limit: new ConvexError("Muitos pedidos de código.") });
    await expect(deliverEmailCode(ports, data)).rejects.toThrow("Muitos pedidos");
    expect(order).toEqual(["limit"]);
    expect(sent).toEqual([]);
    expect(lines).toEqual(["[email] pedido bloqueado pelo limite: a***@example.com"]);
  });
  it("logs a classified reason when Gmail refuses, never the raw error, the code or the full address", async () => {
    const secret = "abcd efgh ijkl mnop";
    const { ports, lines } = setup({ send: Object.assign(new Error(`Invalid login for app@gmail.com password ${secret}`), { code: "EAUTH" }) });
    await expect(deliverEmailCode(ports, data)).rejects.toThrow();
    expect(lines).toEqual(["[email] falha no envio para a***@example.com: credenciais recusadas pelo Gmail"]);
    const text = lines.join("\n");
    for (const forbidden of [secret, "app@gmail.com", "482913", "ana@example.com"]) expect(text).not.toContain(forbidden);
  });
});

describe("code attempt guard", () => {
  it("counts a guess for the normalized address and ignores a missing address", async () => {
    const { ports, order } = setup();
    await guardCodeAttempt(ports, "  Ana@Example.COM ");
    await guardCodeAttempt(ports, undefined);
    await guardCodeAttempt(ports, 42);
    await guardCodeAttempt(ports, "   ");
    expect(order).toEqual(["attempt:ana@example.com"]);
  });
  it("blocks once the budget is spent and logs a masked address", async () => {
    const { ports, lines } = setup({ attempt: new ConvexError("Muitas tentativas.") });
    await expect(guardCodeAttempt(ports, "ana@example.com")).rejects.toThrow("Muitas tentativas");
    expect(lines).toEqual(["[email] tentativas esgotadas: a***@example.com"]);
  });
});

describe("mail failure reasons", () => {
  it("classifies transport errors and hides everything else", () => {
    expect(describeMailFailure(Object.assign(new Error("x"), { code: "EAUTH" }))).toBe("credenciais recusadas pelo Gmail");
    for (const code of ["ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNREFUSED", "EDNS"]) expect(describeMailFailure(Object.assign(new Error("x"), { code }))).toBe("sem conexão com o Gmail");
    expect(describeMailFailure(Object.assign(new Error("x"), { code: "EENVELOPE" }))).toBe("endereço recusado");
    expect(describeMailFailure(new ConvexError("não configurado"))).toBe("e-mail não configurado");
    expect(describeMailFailure(new Error("senha=segredo"))).toBe("erro desconhecido");
    expect(describeMailFailure("texto")).toBe("erro desconhecido");
    expect(describeMailFailure(null)).toBe("erro desconhecido");
  });
  it("masks addresses and pins the Gmail transport", () => {
    expect(maskEmail("ana@example.com")).toBe("a***@example.com");
    const options = gmailTransportOptions("app@gmail.com", "pw");
    expect(options).toMatchObject({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: "app@gmail.com", pass: "pw" } });
    expect(options.connectionTimeout).toBeLessThanOrEqual(15_000);
    expect(options.socketTimeout).toBeLessThanOrEqual(15_000);
  });
});
