import { describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/test";
import schema from "./convex/schema";

const modules = {
  "./convex/_generated/server.ts": () => import("./convex/_generated/server"),
  "./convex/mail.ts": () => import("./convex/mail"),
};
const consume = makeFunctionReference<"mutation">("mail:consume");

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
});
