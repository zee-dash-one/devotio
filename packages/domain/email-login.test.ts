import { describe, expect, it } from "vitest";
import { emailCodeMessage, emailCodeSchema, emailLoginSchema } from "./email-login";

describe("email login contract", () => {
  it("normalizes the address and rejects invalid ones", () => {
    expect(emailLoginSchema.parse({ email: "  Ana@Example.COM " }).email).toBe("ana@example.com");
    expect(emailLoginSchema.safeParse({ email: "sem-arroba" }).success).toBe(false);
    expect(emailLoginSchema.safeParse({ email: `${"a".repeat(160)}@example.com` }).success).toBe(false);
  });
  it("accepts only six digits", () => {
    expect(emailCodeSchema.parse(" 012345 ")).toBe("012345");
    for (const bad of ["12345", "1234567", "12345a", "", "abcdef"]) expect(emailCodeSchema.safeParse(bad).success).toBe(false);
  });
  it("writes a message that carries the code and the lifetime", () => {
    const message = emailCodeMessage("482913");
    expect(message.subject).toContain("482913");
    expect(message.text).toContain("5 minutos");
    expect(message.html).toContain("<strong>482913</strong>");
  });
});
