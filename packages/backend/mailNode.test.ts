import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "./convex/schema";

const sendMail = vi.fn();
const verify = vi.fn();
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => ({ sendMail, verify })) } }));

const modules = {
  "./convex/_generated/server.ts": () => import("./convex/_generated/server"),
  "./convex/mailNode.ts": () => import("./convex/mailNode"),
};
const send = makeFunctionReference<"action">("mailNode:send");
const check = makeFunctionReference<"action">("mailNode:check");
const message = { to: "ana@example.com", subject: "Código", text: "482913", html: "<p>482913</p>" };
const password = "abcdabcdabcdabcd";
const configure = () => { vi.stubEnv("GMAIL_USER", "app@gmail.com"); vi.stubEnv("GMAIL_APP_PASSWORD", password); };

afterEach(() => { vi.unstubAllEnvs(); sendMail.mockReset(); verify.mockReset(); });

describe("mail action", () => {
  it("sends from the configured Gmail account", async () => {
    configure();
    sendMail.mockResolvedValue({});
    await convexTest(schema, modules).action(send, message);
    expect(sendMail).toHaveBeenCalledWith({ from: "Devotio <app@gmail.com>", ...message });
  });
  it("refuses to run without credentials and never contacts Gmail", async () => {
    await expect(convexTest(schema, modules).action(send, message)).rejects.toThrow("ainda não foi configurada");
    vi.stubEnv("GMAIL_USER", "app@gmail.com");
    await expect(convexTest(schema, modules).action(send, message)).rejects.toThrow("ainda não foi configurada");
    expect(sendMail).not.toHaveBeenCalled();
  });
  it("reports a classified reason and leaks neither the password nor the account", async () => {
    configure();
    sendMail.mockRejectedValue(Object.assign(new Error(`Invalid login: app@gmail.com ${password}`), { code: "EAUTH" }));
    const failure = await convexTest(schema, modules).action(send, message).catch((error: Error) => error);
    expect(String(failure)).toContain("credenciais recusadas pelo Gmail");
    expect(String(failure)).not.toContain(password);
    expect(String(failure)).not.toContain("app@gmail.com");
  });
  it("checks the Gmail login without sending anything", async () => {
    configure();
    verify.mockResolvedValueOnce(true);
    expect(await convexTest(schema, modules).action(check, {})).toEqual({ ok: true, reason: "Login no Gmail aceito." });
    verify.mockRejectedValueOnce(Object.assign(new Error(password), { code: "EAUTH" }));
    expect(await convexTest(schema, modules).action(check, {})).toEqual({ ok: false, reason: "credenciais recusadas pelo Gmail" });
    expect(sendMail).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
    expect(await convexTest(schema, modules).action(check, {})).toEqual({ ok: false, reason: "e-mail não configurado" });
  });
});
