import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const directory = resolve(".data/image-preview");
await mkdir(directory, { recursive: true });
await build({ entryPoints: ["packages/backend/rendering/images.node.ts"], bundle: true, platform: "node", format: "cjs", outfile: resolve(directory, "renderer.cjs"), external: ["@resvg/resvg-js"] });
const { renderImages } = (await import(pathToFileURL(resolve(directory, "renderer.cjs")).href)).default;
const content = { date: "2026-10-25", reference: "Colossenses 1:3–23", reflection: "A esperança nos convida a olhar para o dia com gratidão. Em meio às tarefas e às preocupações, podemos fazer uma pausa e reconhecer a presença de Deus.\n\nO amor se revela nos gestos simples: escutar com atenção, acolher quem precisa e oferecer uma palavra de cuidado. Que a fé encontre espaço nas nossas escolhas de hoje.", prayerSuggestion: "Senhor, dá-nos sabedoria e serenidade. Ensina-nos a viver com gratidão, a cuidar uns dos outros e a seguir o teu caminho. Amém." };
const started = performance.now(), files = [];
for await (const { png, ...page } of renderImages(content)) {
  const name = page.variant + "-" + page.page + ".png";
  await writeFile(resolve(directory, name), png); files.push({ ...page, bytes: png.byteLength, name });
}
const result = { milliseconds: Math.round(performance.now()-started), bytes: files.reduce((sum, file) => sum+file.bytes, 0), files };
await writeFile(resolve(directory, "metrics.json"), JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
