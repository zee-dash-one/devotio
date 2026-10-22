import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const bin = path.join(root, ".tools", "graphify", process.platform === "win32" ? "Scripts" : "bin");
const python = path.join(bin, process.platform === "win32" ? "python.exe" : "python");
if (!existsSync(python)) {
  console.error("Graphify não está instalado. Consulte docs/engineering/graphify.md.");
  process.exit(1);
}

const result = spawnSync(python, ["-m", "graphify", ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    PATH: bin + path.delimiter + (process.env.PATH ?? ""),
    GRAPHIFY_NO_AUTO_REFRESH: "1",
  },
});
if (result.error) console.error(`Não foi possível executar Graphify: ${result.error.message}`);
process.exit(result.status ?? 1);
