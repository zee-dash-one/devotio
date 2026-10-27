import { afterEach, expect, it, vi } from "vitest";
import { shareImages, canShareImages } from "./share-images";
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
