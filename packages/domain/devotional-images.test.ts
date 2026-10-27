import { expect, it } from "vitest";
import { imageRevision, imageAvailableToday, imageContentSchema } from "./devotional-images";
const day = { date: "2026-10-25", reference: "João 1:1", reflection: "Reflexão com ação e fé.", prayerSuggestion: "Oração." };
it("hashes only rendered content deterministically and detects editorial corrections", () => {
  expect(imageRevision(day)).toMatch(/^[a-f0-9]{64}$/);
  expect(imageRevision({ ...day })).toBe(imageRevision(day));
  expect(imageRevision({ ...day, reflection: day.reflection + " Amém." })).not.toBe(imageRevision(day));
  expect(imageRevision({ ...day, date: "2026-10-26" })).not.toBe(imageRevision(day));
  expect(imageContentSchema.safeParse({ ...day, reflection: "a".repeat(20001) }).success).toBe(false);
});
it("limits availability to the editorial day in São Paulo", () => {
  expect(imageAvailableToday(day.date, Date.parse("2026-10-26T02:59:59Z"))).toBe(true);
  expect(imageAvailableToday(day.date, Date.parse("2026-10-26T03:00:00Z"))).toBe(false);
});
