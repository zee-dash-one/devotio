import { afterEach, expect, it, vi } from "vitest";
import { shareImages, canShareImages, copyImage, canCopyImage } from "./share-images";
afterEach(() => vi.unstubAllGlobals());
it("shares prepared files immediately without text and respects cancellation", async () => {
  const share = vi.fn().mockResolvedValue(undefined), files = [new File(["png"], "day.png", { type: "image/png" })];
  vi.stubGlobal("navigator", { canShare: () => true, share });
  const pending = shareImages(files);
  expect(share).toHaveBeenCalledWith({ files }); expect(await pending).toBe("shared");
  share.mockRejectedValue(Object.assign(new Error("Cancelado"), { name: "AbortError" }));
  expect(await shareImages(files)).toBe("cancelled");
  vi.stubGlobal("navigator", {}); expect(canShareImages(files)).toBe(false); expect(await shareImages(files)).toBe("unsupported");
});
it("copies one PNG to the clipboard so it can be pasted", async () => {
  const write = vi.fn().mockResolvedValue(undefined);
  const file = new File(["png"], "day.png", { type: "image/png" });
  class Item { constructor(readonly data: Record<string, Blob>) {} }
  vi.stubGlobal("ClipboardItem", Item);
  vi.stubGlobal("navigator", { clipboard: { write } });
  expect(canCopyImage()).toBe(true);
  expect(await copyImage(file)).toBe("copied");
  expect(write).toHaveBeenCalledOnce();
  const item = write.mock.calls[0][0][0] as Item;
  expect(item.data["image/png"]).toBe(file);
  write.mockRejectedValueOnce(new DOMException("sem foco", "NotAllowedError"));
  await expect(copyImage(file)).rejects.toThrow("Clique na página");
  vi.stubGlobal("navigator", {});
  expect(canCopyImage()).toBe(false);
  expect(await copyImage(file)).toBe("unsupported");
});
