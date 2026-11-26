import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { componentsGeneric, makeFunctionReference } from "convex/server";
import type { ComponentApi } from "@convex-dev/better-auth/_generated/component.js";
import betterAuth from "@convex-dev/better-auth/test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import schema from "./convex/schema";
import { createAuth } from "./convex/auth";
import type { MailMessage, MailPorts } from "./convex/mailDelivery";

const modules = {
  "./convex/_generated/server.ts": () => import("./convex/_generated/server"),
  "./convex/mail.ts": () => import("./convex/mail"),
};
const components = componentsGeneric() as unknown as { betterAuth: ComponentApi };
const consume = makeFunctionReference<"mutation">("mail:consume");
type SignedIn = { token: string; user: { id: string; email: string; emailVerified: boolean } };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-26T12:00:00Z"));
  vi.stubEnv("SITE_URL", "https://devotio.example.com");
  vi.stubEnv("CONVEX_SITE_URL", "https://pilot.convex.site");
  vi.stubEnv("GOOGLE_CLIENT_ID", "id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-123");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

function setup() {
  const t = convexTest(schema, modules);
  betterAuth.register(t);
  rateLimiter.register(t);
  const mailbox: MailMessage[] = [];
  // The SMTP send is faked. Request limits are the real Convex functions. The guess
  // budget is mirrored in memory: t.run wraps the call in one transaction, so a failed
  // sign-in would roll back the real counter, which production commits separately.
  // The real counter is proven in mail.test.ts.
  const guesses = new Map<string, number>();
  const ports: MailPorts = {
    limit: async (email) => { await t.mutation(consume, { email }); guesses.set(email, 0); },
    attempt: async (email) => {
      const used = guesses.get(email) ?? 0;
      if (used >= 3) throw new Error("Muitas tentativas. Peça um novo código.");
      guesses.set(email, used + 1);
    },
    send: async (message) => { mailbox.push(message); },
    log: () => {},
  };
  const run = <T,>(task: (auth: ReturnType<typeof createAuth>) => Promise<T>) => t.run(ctx => task(createAuth(ctx as never, ports)));
  const code = () => /\b(\d{6})\b/.exec(mailbox.at(-1)?.text ?? "")?.[1] ?? "";
  const request = (email: string) => run(auth => auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } }));
  const signIn = (email: string, otp: string) => run(auth => auth.api.signInEmailOTP({ body: { email, otp } }) as Promise<SignedIn>);
  const users = async () => (await t.run(ctx => ctx.runQuery(components.betterAuth.adapter.findMany, { model: "user", paginationOpts: { cursor: null, numItems: 50 } }))).page as { _id: string; email: string; emailVerified: boolean }[];
  const wrongFor = (otp: string) => (otp === "123456" ? "654321" : "123456");
  const createUser = (emailVerified: boolean) => t.run(ctx => ctx.runMutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { email: "ana@example.com", name: "Ana", emailVerified, createdAt: Date.now(), updatedAt: Date.now() } },
  })) as Promise<{ _id: string }>;
  return { mailbox, code, request, signIn, users, wrongFor, createUser };
}

describe("email code login with the real Better Auth", () => {
  it("mails a six digit code, then signs a new address in with a verified email", async () => {
    const { request, signIn, code, mailbox, users } = setup();
    await request("ana@example.com");
    expect(mailbox).toHaveLength(1);
    expect(mailbox[0].to).toBe("ana@example.com");
    expect(code()).toMatch(/^\d{6}$/);
    const result = await signIn("ana@example.com", code());
    expect(result.user.email).toBe("ana@example.com");
    expect(result.user.emailVerified).toBe(true);
    expect(await users()).toHaveLength(1);
  });
  it("accepts a code only once", async () => {
    const { request, signIn, code } = setup();
    await request("ana@example.com");
    const otp = code();
    await signIn("ana@example.com", otp);
    await expect(signIn("ana@example.com", otp)).rejects.toThrow();
  });
  it("tolerates typos but gives only three guesses per code", async () => {
    const { request, signIn, code, users, wrongFor } = setup();
    await request("ana@example.com");
    const otp = code();
    await expect(signIn("ana@example.com", wrongFor(otp))).rejects.toThrow();
    await expect(signIn("ana@example.com", wrongFor(otp))).rejects.toThrow();
    await signIn("ana@example.com", otp);
    expect(await users()).toHaveLength(1);
  });
  it("locks the code after three wrong guesses even if the fourth is right", async () => {
    const { request, signIn, code, users, wrongFor } = setup();
    await request("ana@example.com");
    const otp = code();
    for (let i = 0; i < 3; i += 1) await expect(signIn("ana@example.com", wrongFor(otp))).rejects.toThrow();
    await expect(signIn("ana@example.com", otp)).rejects.toThrow("Muitas tentativas");
    expect(await users()).toHaveLength(0);
  });
  it("gives a fresh budget of guesses only when a new code is requested", async () => {
    const { request, signIn, code, wrongFor } = setup();
    await request("ana@example.com");
    const wrong = wrongFor(code());
    for (let i = 0; i < 3; i += 1) await expect(signIn("ana@example.com", wrong)).rejects.toThrow();
    await request("ana@example.com");
    await signIn("ana@example.com", code());
  });
  it("keeps the guess budget per address", async () => {
    const { request, signIn, code, wrongFor } = setup();
    await request("ana@example.com");
    const ana = code();
    await request("rui@example.com");
    const rui = code();
    const wrong = wrongFor(ana + rui);
    for (let i = 0; i < 3; i += 1) await expect(signIn("ana@example.com", wrong)).rejects.toThrow();
    await signIn("rui@example.com", rui);
  });
  it("rejects an expired code", async () => {
    const { request, signIn, code } = setup();
    await request("ana@example.com");
    const otp = code();
    vi.advanceTimersByTime(5 * 60_000 + 1000);
    await expect(signIn("ana@example.com", otp)).rejects.toThrow();
  });
  it("does not let a code from one address open another", async () => {
    const { request, signIn, code } = setup();
    await request("ana@example.com");
    await expect(signIn("rui@example.com", code())).rejects.toThrow();
  });
  it("makes the previous code useless when a new one is requested", async () => {
    const { request, signIn, code } = setup();
    await request("ana@example.com");
    const first = code();
    await request("ana@example.com");
    const second = code();
    if (first !== second) await expect(signIn("ana@example.com", first)).rejects.toThrow();
    await signIn("ana@example.com", second);
  });
  it("reaches the same account as Google for the same address instead of creating a second one", async () => {
    const { request, signIn, code, users, createUser } = setup();
    const google = await createUser(true);
    await request("Ana@Example.com");
    const result = await signIn("ana@example.com", code());
    expect(result.user.id).toBe(google._id);
    expect(await users()).toHaveLength(1);
  });
  it("marks an unverified address as verified once the code is confirmed", async () => {
    const { request, signIn, code, users, createUser } = setup();
    await createUser(false);
    await request("ana@example.com");
    await signIn("ana@example.com", code());
    // The sign-in response carries the user as it was; the stored account is what counts.
    const stored = await users();
    expect(stored).toHaveLength(1);
    expect(stored[0].emailVerified).toBe(true);
  });
  it("sends no sixth mail in ten minutes for the same address", async () => {
    const { request, mailbox } = setup();
    for (let i = 0; i < 5; i += 1) await request("ana@example.com");
    expect(mailbox).toHaveLength(5);
    await request("ana@example.com").catch(() => {});
    expect(mailbox).toHaveLength(5);
  });
});
