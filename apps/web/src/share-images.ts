export function canShareImages(files: File[]): boolean {
  try { return files.length > 0 && typeof navigator.share === "function" && navigator.canShare?.({ files }) === true; } catch { return false; }
}
export async function shareImages(files: File[]): Promise<"shared" | "cancelled" | "unsupported"> {
  if (!canShareImages(files)) return "unsupported";
  try { await navigator.share({ files }); return "shared"; }
  catch (error) { if (error instanceof Error && error.name === "AbortError") return "cancelled"; throw error; }
}
