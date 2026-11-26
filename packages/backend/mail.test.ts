import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/test";
import schema from "./convex/schema";

const modules = {
  "./convex/_generated/server.ts": () => import("./convex/_generated/server"),
  "./convex/mail.ts": () => import("./convex/mail"),
};
const consume = makeFunctionReference<"mutation">("mail:consume");

afterEach(() => { vi.useRealTimers(); });
function setup() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  return t;
}

describe("email code request limit", () => {
  it("allows five requests per address and answers the sixth with a Portuguese message", async () => {
    const t = setup();
    for (let i = 0; i < 5; i += 1) await t.mutation(consume, { email: "ana@example.com" });
    await expect(t.mutation(consume, { email: "Ana@Example.com" })).rejects.toThrow("Muitos pedidos de código");
    await t.mutation(consume, { email: "rui@example.com" });
  });
  it("tells the page whether mail can be sent without exposing the credentials", async () => {
    const t = setup();
    const available = makeFunctionReference<"query">("mail:available");
    expect(await t.query(available, {})).toBe(false);
    vi.stubEnv("GMAIL_USER", "app@example.com");
    expect(await t.query(available, {})).toBe(false);
    vi.stubEnv("GMAIL_APP_PASSWORD", "abcdabcdabcdabcd");
    expect(await t.query(available, {})).toBe(true);
    vi.unstubAllEnvs();
  });
  it("caps one address at ten codes a day even when it waits out the short window", async () => {
    vi.useFakeTimers();
    const t = setup();
    for (let i = 0; i < 10; i += 1) {
      await t.mutation(consume, { email: "ana@example.com" });
      vi.advanceTimersByTime(11 * 60_000);
    }
    await expect(t.mutation(consume, { email: "ana@example.com" })).rejects.toThrow("Muitos pedidos de código");
    vi.advanceTimersByTime(24 * 60 * 60_000);
    await t.mutation(consume, { email: "ana@example.com" });
  });
  it("allows three guesses per code, then blocks until a new code is requested", async () => {
    const t = setup();
    const attempt = makeFunctionReference<"mutation">("mail:attempt");
    const results = [];
    for (let i = 0; i < 5; i += 1) results.push(await t.mutation(attempt, { email: "Ana@Example.com" }).then(() => "ok", (error: Error) => String(error.message ?? error)));
    expect(results.slice(0, 3)).toEqual(["ok", "ok", "ok"]);
    expect(results[3]).toContain("Muitas tentativas");
    expect(results[4]).toContain("Muitas tentativas");
    await t.mutation(attempt, { email: "rui@example.com" });
    await t.mutation(consume, { email: "ana@example.com" });
    await t.mutation(attempt, { email: "ana@example.com" });
  });
});
