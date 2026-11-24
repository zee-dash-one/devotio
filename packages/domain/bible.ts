import { z } from "zod";
import type { Watch } from "./types";
import type { BibleChapter, BibleCatalog, BibleResults, BibleRepository, BibleReaderRepository } from "./reading";
import { searchWords } from "./reading";
import { alm1911Base, bibleCatalogSchema, bibleChapterSchema, bibleSearchSchema, bibleSearchIndexSchema, type BibleVersion } from "./validators/bible";

export interface BibleCacheStorage { read(): unknown; write(chapters: BibleChapter[]): void }
export interface BibleTransport { load(path: string): Promise<unknown>; storage?: BibleCacheStorage }
function staticEdition(transport: BibleTransport, version: BibleVersion, base: string, persistChapters: boolean): BibleReaderRepository {
  const chapters = new Map<string, BibleChapter>();
  const pending = new Map<string, Promise<BibleChapter | null>>();
  let pinned: string[] = [];
  let catalog: Promise<BibleCatalog> | undefined;
  let searchIndex: Promise<z.infer<typeof bibleSearchIndexSchema>> | undefined;
  let searches = 0;
  if (persistChapters) {
    try {
      const saved = z.array(bibleChapterSchema).max(6).parse(transport.storage?.read() ?? []);
      for (const c of saved) if (c.version === version) chapters.set(`${c.book.abbrev}:${c.chapter}`, c);
    } catch { /* Corrupt or unavailable cache never blocks reading. */ }
  }
  const persist = () => {
    if (!persistChapters) return;
    while (chapters.size > 6) {
      const removable = [...chapters.keys()].find(k => !pinned.includes(k));
      if (!removable) break;
      chapters.delete(removable);
    }
    try { transport.storage?.write([...chapters.values()]); } catch { /* Continue in memory. */ }
  };
  function getCatalog(): Promise<BibleCatalog> {
    return catalog ??= transport.load(`${base}/catalog.json`).then(raw => {
      const data = bibleCatalogSchema.parse(raw);
      if (data.version !== version) throw new Error("Edição bíblica divergente.");
      return data;
    }).catch(error => { catalog = undefined; throw error; });
  }
  async function chapter(book: string, number: number): Promise<BibleChapter | null> {
    const key = `${book}:${number}`;
    const cached = chapters.get(key);
    if (cached) { chapters.delete(key); chapters.set(key, cached); return cached; }
    const existing = pending.get(key);
    if (existing) return existing;
    const load = (async () => {
      const data = await getCatalog();
      const entry = data.books.find(b => b.abbrev === book);
      if (!entry || !Number.isInteger(number) || number < 1 || number > entry.chapters) return null;
      const value = bibleChapterSchema.parse(await transport.load(`${base}/${book}/${number}.json`));
      if (value.version !== version || value.book.abbrev !== book || value.chapter !== number ||
          value.verses.some((v, i) => v.number !== i + 1 || v.abbrev !== book || v.chapter !== number))
        throw new Error("Capítulo bíblico divergente.");
      chapters.set(key, value); persist(); return value;
    })().finally(() => pending.delete(key));
    pending.set(key, load);
    return load;
  }
  const watch = <T>(read: () => Promise<T>, release?: () => void): Watch<T> => (next, error) => {
    let active = true;
    void read().then(value => { if (active) next(value); }).catch(e => {
      if (active) error(e instanceof Error ? e : new Error("Não foi possível ler a Bíblia."));
    });
    return () => { if (active) { active = false; release?.(); } };
  };
  return {
    watchBible: () => watch(getCatalog),
    watchChapter: (book, number, preload = false) => watch(async () => {
      if (!preload) {
        pinned = [number - 1, number, number + 1].map(n => `${book}:${n}`);
        persist();
      }
      return chapter(book, number);
    }),
    watchSearch: (query, page) => (next, error) => {
      searches++;
      return watch(async (): Promise<BibleResults> => {
        const { text } = bibleSearchSchema.parse({ text: query, page });
        const words = searchWords(text);
        if (!words.length) return { verses: [], total: 0, page };
        const loading = searchIndex ??= transport.load(`${base}/search.json`).then(raw => bibleSearchIndexSchema.parse(raw));
        const index = await loading;
        const matches = index.filter(row => {
          const tokens = row[3].split(" ");
          return words.every(word => tokens.some(token => token.startsWith(word)));
        });
        const verses: BibleResults["verses"] = [];
        const hydrated = new Map<string, BibleChapter | null>();
        for (const [book, number, verseNumber] of matches.slice(page * 40, (page + 1) * 40)) {
          const key = `${book}:${number}`;
          if (!hydrated.has(key)) hydrated.set(key, await chapter(book, number));
          const verse = hydrated.get(key)?.verses.find(v => v.number === verseNumber);
          if (!verse) throw new Error("Versículo do índice não encontrado.");
          verses.push(verse);
        }
        return { verses, total: matches.length, page };
      }, () => { searches--; if (!searches) searchIndex = undefined; })(next, error);
    },
  };
}
export function createBibleRepository(transport: BibleTransport, legacy?: BibleReaderRepository, licensed: { version: BibleVersion; base: string }[] = []): BibleRepository {
  const staticReader = staticEdition(transport, "alm1911", alm1911Base, true);
  const extras = new Map(licensed.map(item => [item.version, staticEdition(transport, item.version, item.base, false)]));
  return {
    versions: [...(legacy ? ["aa" as const] : []), "alm1911" as const, ...licensed.map(item => item.version)],
    forVersion(version: BibleVersion) {
      if (version === "alm1911") return staticReader;
      const extra = extras.get(version);
      if (extra) return extra;
      if (legacy && version === "aa") return legacy;
      throw new Error("Esta versão da Bíblia não está disponível.");
    },
  };
}
