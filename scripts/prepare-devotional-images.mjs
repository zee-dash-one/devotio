import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const apply = process.argv.includes("--apply");
const dates = process.argv.slice(2).filter(arg => arg !== "--apply");
if (!dates.length) dates.push(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
if (dates.length > 31 || dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) throw new Error("Informe até 31 datas no formato AAAA-MM-DD.");
console.log("Alvo: dev upbeat-jellyfish-720 (backend do piloto). " + (apply ? "Preparar imagens: " : "Simular: ") + dates.join(", "));
const directory = mkdtempSync(join(tmpdir(), "devotio-image-selector-")), selector = join(directory,"deployment.txt");
try {
  writeFileSync(selector, "CONVEX_DEPLOYMENT=dev:upbeat-jellyfish-720\n");
  const result = spawnSync(process.execPath, [resolve("node_modules/convex/bin/main.js"), "run", "devotionalImages:ensureDates", JSON.stringify({ dates, dryRun: !apply }), "--env-file", selector], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { unlinkSync(selector); rmdirSync(directory); }
