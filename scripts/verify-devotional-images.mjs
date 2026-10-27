import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const directory = resolve(".data/image-verification"); await mkdir(directory, { recursive: true });
await build({ entryPoints: ["packages/domain/devotional-images.ts"], bundle: true, platform: "node", format: "cjs", outfile: resolve(directory,"domain.cjs") });
const { imageRevision } = (await import(pathToFileURL(resolve(directory,"domain.cjs")).href)).default;
const base = "http://127.0.0.1:3000";
const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const post = (body, cookie = "") => fetch(base+"/__local/command", { method: "POST", headers: { "Content-Type": "application/json", Origin: base, Cookie: cookie, "X-Devotio-Profile": "marina" }, body: JSON.stringify(body) });
const login = await post({ action: "login", profileId: "marina" }); assert.equal(login.status,200);
const cookie = login.headers.get("set-cookie").split(";")[0], controller = new AbortController(), deadline = setTimeout(() => controller.abort(),30000);
try {
  const input = { query: "home", date, timeZone: "America/Sao_Paulo" };
  const home = await fetch(base+"/__local/query?input="+encodeURIComponent(JSON.stringify(input)), { headers: { Cookie: cookie, "X-Devotio-Profile": "marina" } }).then(r => r.json());
  assert.ok(home.devotional, "O dia atual precisa de um devocional local.");
  const revision = imageRevision(home.devotional);
  const path = "/__local/images?" + new URLSearchParams({ id: home.devotional.id, revision, profile: "marina" });
  assert.equal((await fetch(base+path)).status,401);
  const stream = await fetch(base+path, { headers: { Cookie: cookie }, signal: controller.signal }); assert.equal(stream.status,200);
  const reader = stream.body.getReader(), decoder = new TextDecoder(); let pending = "", manifest;
  while (!manifest) {
    const chunk = await reader.read(); assert.ok(!chunk.done);
    pending += decoder.decode(chunk.value,{ stream: true });
    let end;
    while ((end = pending.indexOf("\n\n")) >= 0) {
      const event = pending.slice(0,end); pending = pending.slice(end+2);
      if (!event.startsWith("data: ")) continue;
      const value = JSON.parse(event.slice(6));
      assert.notEqual(value.status,"failed"); assert.notEqual(value.status,"unavailable");
      if (value.status === "ready") manifest = value;
    }
  }
  await reader.cancel(); clearTimeout(deadline);
  assert.equal(new Set(manifest.files.map(file => file.variant)).size,6);
  const file = manifest.files[0], url = base+file.url;
  assert.equal((await fetch(url)).status,401);
  const first = await fetch(url,{ headers: { Cookie: cookie } }), second = await fetch(url,{ headers: { Cookie: cookie } });
  assert.equal(first.headers.get("content-type"),"image/png");
  const bytes = Buffer.from(await first.arrayBuffer()); assert.deepEqual(bytes,Buffer.from(await second.arrayBuffer()));
  assert.equal(bytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(bytes.readUInt32BE(16),file.width); assert.equal(bytes.readUInt32BE(20),file.height);
  console.log("Imagens locais verificadas: SSE autenticado, seis variantes, PNG real, dimensões e reutilização do mesmo arquivo.");
} finally { clearTimeout(deadline); controller.abort(); await post({ action: "logout" },cookie); }
