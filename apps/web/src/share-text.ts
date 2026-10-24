export type ShareResult = "shared" | "copied" | "manual" | "cancelled";
export async function copyText(text: string): Promise<ShareResult> {
  try {
    if (!navigator.clipboard?.writeText) return "manual";
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch { return "manual"; }
}
export async function shareText(text: string): Promise<ShareResult> {
  if (navigator.share) {
    try { await navigator.share({ text }); return "shared"; }
    catch (error) { if (error instanceof Error && error.name === "AbortError") return "cancelled"; }
  }
  return copyText(text);
}
