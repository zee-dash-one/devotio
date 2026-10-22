import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { LocalDatabase } from "./database.local";
import { createLocalHandler } from "./http.local";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });
async function setup() {
  const db = new LocalDatabase(":memory:");
  const server: Server = createServer(createLocalHandler(db));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(() => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close(err => { db.close(); if (err) reject(err); else resolve(); }); }));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Porta ausente");
  const base = `http://127.0.0.1:${address.port}`;
  const post = (value: unknown, cookie = "", profile = "marina", origin = base) => fetch(base + "/command", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie, "X-Devotio-Profile": profile }, body: JSON.stringify(value) });
  const query = (input: unknown, cookie = "", profile = "marina") => fetch(base + "/query?input=" + encodeURIComponent(JSON.stringify(input)), { headers: { Cookie: cookie, "X-Devotio-Profile": profile } });
  return { base, post, query };
}
describe("HTTP local", () => {
  it("entrega avisos por SSE autenticado e encerra ao revogar a sessão", async () => {
    const { base, post } = await setup();
    expect((await fetch(base + "/events?profile=marina")).status).toBe(401);
    const login = await post({ action: "login", profileId: "marina" });
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    expect((await fetch(base + "/events?profile=daniel", { headers: { Cookie: cookie } })).status).toBe(401);
    const response = await fetch(base + "/events?profile=marina", { headers: { Cookie: cookie }, signal: AbortSignal.timeout(5000) });
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const reader = response.body!.getReader(), decoder = new TextDecoder();
    async function event() { let text = ""; while (!text.includes("event: notifications")) { const chunk = await reader.read(); if (chunk.done) throw new Error("Conexão encerrada antes do aviso"); text += decoder.decode(chunk.value); } return text; }
    expect(await event()).toContain('"unread":0');
    const admin = await post({ action: "login", profileId: "daniel" }, "", "daniel");
    await post({ action: "sendMessage", id: "esperanca", content: "Aviso em tempo real" }, admin.headers.get("set-cookie")!.split(";")[0], "daniel");
    expect(await event()).toContain('"unread":1');
    await post({ action: "logout" }, cookie);
    expect((await reader.read()).done).toBe(true);
  });
  it("rejeita visitante, origem externa, identidade trocada e logout revoga cookie", async () => {
    const { base, post, query } = await setup();
    expect((await query({ query: "communities" })).status).toBe(401);
    expect((await post({ action: "login", profileId: "marina" }, "", "marina", "https://example.com")).status).toBe(403);
    const login = await post({ action: "login", profileId: "marina" });
    expect(login.status).toBe(200);
    expect(login.headers.get("set-cookie")).toContain("HttpOnly; SameSite=Strict");
    expect(login.headers.get("set-cookie")).toContain("Max-Age=2592000");
    const identity = await login.json();
    expect(identity.profile.id).toBe("marina");
    expect(identity.expiresAt).toBeGreaterThan(Date.now() + 29 * 86400000);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    const session = await fetch(base + "/session", { headers: { Cookie: cookie } }).then(r => r.json());
    expect(session.expiresAt).toBe(identity.expiresAt);
    expect((await query({ query: "communities" }, cookie)).status).toBe(200);
    expect((await query({ query: "communities" }, cookie, "daniel")).status).toBe(401);
    expect((await post({ action: "sendMessage", id: "esperanca", content: "Tentativa", userId: "daniel" }, cookie)).status).toBe(403);
    expect((await post({ action: "setTick", itemId: "prayer-0", checked: "true" }, cookie)).status).toBe(400);
    await post({ action: "logout" }, cookie);
    expect((await query({ query: "communities" }, cookie)).status).toBe(401);
  });
});
