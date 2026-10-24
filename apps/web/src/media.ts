export const MOBILE_QUERY = "(max-width: 640px)";
export function isMobileViewport() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches;
}
