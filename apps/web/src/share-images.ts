export function canShareImages(files: File[]): boolean {
  try { return files.length > 0 && typeof navigator.share === "function" && navigator.canShare?.({ files }) === true; } catch { return false; }
}
export async function shareImages(files: File[]): Promise<"shared" | "cancelled" | "unsupported"> {
  if (!canShareImages(files)) return "unsupported";
  try { await navigator.share({ files }); return "shared"; }
  catch (error) { if (error instanceof Error && error.name === "AbortError") return "cancelled"; throw error; }
}
export function canCopyImage(): boolean {
  return typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function";
}
export async function copyImage(file: File): Promise<"copied" | "unsupported"> {
  if (!canCopyImage()) return "unsupported";
  const png = file.type === "image/png" ? file : new Blob([file], { type: "image/png" });
  try { await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]); }
  catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") throw new Error("Não foi possível copiar a imagem. Clique na página e tente de novo.");
    throw error;
  }
  return "copied";
}
