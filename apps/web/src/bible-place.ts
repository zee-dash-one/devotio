const key = "devotio:bible-place";
const eventName = "devotio:bible-place";
export const defaultBiblePlace = { book: "jo", chapter: 1 };
let snapshot = defaultBiblePlace;

function storedPlace() {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "null") as { book?: unknown; chapter?: unknown };
    if (
      raw &&
      typeof raw.book === "string" &&
      /^[a-z0-9]{1,6}$/.test(raw.book) &&
      Number.isInteger(raw.chapter) &&
      (raw.chapter as number) >= 1 &&
      (raw.chapter as number) <= 150
    )
      return { book: raw.book, chapter: raw.chapter as number };
  } catch {
    /* A damaged value falls back to João 1. */
  }
  return defaultBiblePlace;
}

export function rememberedBiblePlace() {
  const next = storedPlace();
  if (next.book !== snapshot.book || next.chapter !== snapshot.chapter) snapshot = next;
  return snapshot;
}

export function rememberBiblePlace(book: string, chapter: number) {
  const encoded = JSON.stringify({ book, chapter });
  try {
    if (localStorage.getItem(key) === encoded) {
      if (snapshot.book !== book || snapshot.chapter !== chapter) snapshot = { book, chapter };
      return;
    }
    localStorage.setItem(key, encoded);
  } catch {
    return;
  }
  snapshot = { book, chapter };
  window.dispatchEvent(new Event(eventName));
}

export function subscribeBiblePlace(listener: () => void) {
  window.addEventListener(eventName, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(eventName, listener);
    window.removeEventListener("storage", listener);
  };
}
