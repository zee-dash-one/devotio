import { describe, expect, it } from "vitest";
import { LocalEmailLogin } from "./email-login.local";

function setup() {
  let now = Date.parse("2026-11-26T12:00:00Z");
  const lines: string[] = [];
  const login = new LocalEmailLogin(() => now, line => lines.push(line));
  return { login, lines, advance: (ms: number) => { now += ms; } };
}

describe("local email code login", () => {
  it("issues a six digit code, prints it and accepts it once", () => {
    const { login, lines } = setup();
    const { devCode } = login.request("ana@example.com");
    expect(devCode).toMatch(/^\d{6}$/);
    expect(lines[0]).toContain(devCode);
    login.verify("ana@example.com", devCode);
    expect(() => login.verify("ana@example.com", devCode)).toThrow("inválido ou expirado");
  });
  it("expires after five minutes", () => {
    const { login, advance } = setup();
    const { devCode } = login.request("ana@example.com");
    advance(5 * 60_000 + 1);
    expect(() => login.verify("ana@example.com", devCode)).toThrow("inválido ou expirado");
  });
  it("burns the code after three wrong attempts", () => {
    const { login } = setup();
    const { devCode } = login.request("ana@example.com");
    const wrong = devCode === "000000" ? "111111" : "000000";
    for (let i = 0; i < 3; i += 1) expect(() => login.verify("ana@example.com", wrong)).toThrow("inválido ou expirado");
    expect(() => login.verify("ana@example.com", devCode)).toThrow("inválido ou expirado");
  });
  it("keeps codes per address and limits requests", () => {
    const { login, advance } = setup();
    const first = login.request("ana@example.com").devCode;
    const second = login.request("rui@example.com").devCode;
    expect(() => login.verify("ana@example.com", second === first ? "999999" : second)).toThrow();
    for (let i = 0; i < 4; i += 1) login.request("ana@example.com");
    expect(() => login.request("ana@example.com")).toThrow("Muitos pedidos");
    advance(10 * 60_000 + 1);
    expect(login.request("ana@example.com").devCode).toMatch(/^\d{6}$/);
  });
});
