import { createBibleRepository, alm1911Revision, bibleEditionPointerSchema, licensedBibleVersions, type BibleReaderRepository, type BibleVersion } from "domain/core";

export async function licensedEditions(): Promise<{ version: BibleVersion; base: string }[]> {
  const found: { version: BibleVersion; base: string }[] = [];
  for (const version of licensedBibleVersions) {
    try {
      const response = await fetch(`/bibles/${version}/edition.json`, { cache: "no-store" });
      if (!response.ok) continue;
      const parsed = bibleEditionPointerSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.version !== version) continue;
      found.push({ version, base: `/bibles/${version}/${parsed.data.revision}` });
    } catch { /* Missing or HTML fallback keeps the edition hidden. */ }
  }
  return found;
}

/** Browser persistence/HTTP only; edition, validation and cache policies live in domain. */
export function createWebBible(owner: string, legacy?: BibleReaderRepository, licensed: { version: BibleVersion; base: string }[] = []) {
  const key = `devotio:bible:${alm1911Revision}:${owner}`;
  return createBibleRepository({
    async load(path) {
      const response = await fetch(path, { cache: "force-cache", signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("Não foi possível carregar a edição bíblica.");
      return response.json() as Promise<unknown>;
    },
    storage: {
      read() { try { return JSON.parse(localStorage.getItem(key) ?? "[]") as unknown; } catch { return []; } },
      write(chapters) { localStorage.setItem(key, JSON.stringify(chapters)); },
    },
  }, legacy, licensed);
}
