import { expect, it } from "vitest";
import { renderImages } from "./images.node";
const content = { date: "2026-10-25", reference: "Colossenses 1:3–23", reflection: "Ação, fé e esperança. " .repeat(30), prayerSuggestion: "Senhor, ensina-nos a cuidar. Amém." };
it("renders six PNG variants with correct dimensions and numbered overflow pages", async () => {
  const pages = [];
  for await (const page of renderImages(content)) {
    expect(Buffer.from(page.png).subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(Buffer.from(page.png).readUInt32BE(16)).toBe(page.width);
    expect(Buffer.from(page.png).readUInt32BE(20)).toBe(page.height);
    expect(page.png.byteLength).toBeGreaterThan(10000); pages.push(page);
  }
  expect(new Set(pages.map(p => p.variant)).size).toBe(6);
  for (const variant of new Set(pages.map(p => p.variant))) {
    const subset = pages.filter(p => p.variant === variant);
    expect(subset.map(p => p.page)).toEqual(Array.from({ length: subset[0].pages }, (_, i) => i+1));
  }
  expect(pages.find(p => p.variant === "square-paper")!.pages).toBeGreaterThan(1);
});
it("rejects unsupported glyphs and excessive pages instead of silently cutting text", async () => {
  await expect(renderImages({ ...content, reflection: "Texto 😀" }).next()).rejects.toThrow("caractere");
  const render = async () => { for await (const _page of renderImages({ ...content, reflection: "texto ".repeat(3000) })) { /* Consume until the operational limit. */ } };
  await expect(render()).rejects.toThrow("dez páginas");
});
