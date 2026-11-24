import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { licensedBibleVersions, alm1911DatasetSchema } from "../packages/domain/validators/bible.ts";

const closedTest = process.env.DEVOTIO_CLOSED_TEST === "1";
const productionBuild = process.argv.includes("--build");
for (const version of licensedBibleVersions) {
  const source = new URL(`../docs/bibles/licensed/${version}.json`, import.meta.url);
  const editionRoot = new URL(`../apps/web/public/bibles/${version}/`, import.meta.url);
  if (!existsSync(source) || (productionBuild && !closedTest)) {
    await rm(editionRoot, { recursive: true, force: true });
    console.log(`${version}: arquivo ausente ou fora do teste fechado; versão oculta.`);
    continue;
  }
  const raw = await readFile(source);
  const books = alm1911DatasetSchema.parse(JSON.parse(raw.toString("utf8").replace(/^\uFEFF/, "")));
  const revision = createHash("sha256").update(raw).digest("hex");
  const total = books.reduce((sum, book) => sum + book.chapters.reduce((count, chapter) => count + chapter.length, 0), 0);
  const root = new URL(`${revision}/`, editionRoot);
  await mkdir(root, { recursive: true });
  const catalog = { version, books: books.map(({ chapters, ...book }) => ({ ...book, chapters: chapters.length })), verses: total, importedAt: Date.now(), source: `docs/bibles/licensed/${version}.json` };
  const rows = [];
  for (const book of books) {
    await mkdir(new URL(`${book.abbrev}/`, root), { recursive: true });
    for (const [index, texts] of book.chapters.entries()) {
      const chapter = {
        version, book: { abbrev: book.abbrev, name: book.name, chapters: book.chapters.length, testament: book.testament, order: book.order },
        chapter: index + 1,
        verses: texts.map((text, number) => ({ abbrev: book.abbrev, bookName: book.name, chapter: index + 1, number: number + 1, text })),
      };
      await writeFile(new URL(`${book.abbrev}/${index + 1}.json`, root), JSON.stringify(chapter));
      for (const verse of chapter.verses) {
        const words = verse.text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
        rows.push([book.abbrev, verse.chapter, verse.number, [...new Set(words)].join(" ")]);
      }
    }
  }
  await writeFile(new URL("search.json", root), JSON.stringify(rows));
  await writeFile(new URL("catalog.json", root), JSON.stringify(catalog));
  await writeFile(new URL("edition.json", editionRoot), JSON.stringify({ version, revision, verses: total, books: 66 }));
  console.log(`${version}: pacote do teste fechado gerado (${total} versículos).`);
}
