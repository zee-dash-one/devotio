import type { IncomingMessage, ServerResponse } from "node:http";
import { localCommandSchema, localQuerySchema, validationMessage } from "../../domain/index";
import { ZodError } from "zod";
import { LocalDatabase, LocalError, profiles } from "./database.local";
import { LOCAL_SESSION_SECONDS } from "../../domain/local-cache";

import { LocalImages } from "./images.local";
import { imageRequestSchema, canManageEditorial } from "../../domain/index";
const cookieName = "devotio_local_session";
function token(req: IncomingMessage) {
  return req.headers.cookie?.split(";").map(v => v.trim()).find(v => v.startsWith(cookieName + "="))?.slice(cookieName.length + 1);
}
function cookie(res: ServerResponse, value: string, maxAge: number) {
  res.setHeader("Set-Cookie", `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`);
}
async function body(req: IncomingMessage): Promise<unknown> {
  let content = "";
  for await (const chunk of req) {
    content += String(chunk);
    if (Buffer.byteLength(content) > 65536) throw new LocalError("O conteúdo enviado é muito grande.", 413);
  }
  try { return JSON.parse(content); } catch { throw new LocalError("Requisição inválida."); }
}
export function createLocalHandler(database: LocalDatabase, images?: LocalImages) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, data: unknown) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(JSON.stringify(data));
    };
    try {
      const host = req.headers.host ?? "";
      if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "")) throw new LocalError("Conexão não local.", 403);
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) throw new LocalError("O ambiente de desenvolvimento só aceita acesso local.", 403);
      if (req.headers.origin && req.headers.origin !== `http://${host}`) throw new LocalError("Origem da requisição inválida.", 403);
      const url = new URL(req.url ?? "/", `http://${host}`);
      const path = url.pathname.replace(/^\/__local/, "");
      const sessionToken = token(req);
      if (images && ["/images", "/image-file", "/image-retry"].includes(path)) {
        const user = database.session(sessionToken);
        if (!user) throw new LocalError("Sua sessão mudou. Entre novamente.", 401);
        if (path === "/images" && req.method === "GET") {
          if (url.searchParams.get("profile") !== user.id) throw new LocalError("Sua sessão mudou.", 401);
          const input = imageRequestSchema.parse({ id: url.searchParams.get("id"), revision: url.searchParams.get("revision") });
          res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "Connection": "keep-alive" }); res.flushHeaders();
          const write = () => { if (!database.session(sessionToken)) { res.end(); return; } res.write("data: " + JSON.stringify(images.manifest(input.id, input.revision)) + "\n\n"); };
          const stop = images.subscribe(write); write();
          const midnight = setTimeout(write, Math.max(1, Math.min(2147483647, Date.parse(input.id + "T03:00:00Z")+86400000-database.now())));
          const heartbeat = setInterval(() => res.write(": keepalive\n\n"), 25000);
          const expiry = setTimeout(() => res.end(), Math.min(2147483647, (database.sessionExpiresAt(sessionToken) ?? Date.now())-Date.now()));
          res.on("close", () => { stop(); clearInterval(heartbeat); clearTimeout(expiry); clearTimeout(midnight); }); return;
        }
        if (path === "/image-file" && req.method === "GET") {
          const bytes = images.file(url.searchParams.get("date") ?? "", url.searchParams.get("revision") ?? "", url.searchParams.get("variant") ?? "", Number(url.searchParams.get("page")));
          if (!bytes) throw new LocalError("Imagem indisponível.", 404);
          res.writeHead(200, { "Content-Type": "image/png", "Content-Length": bytes.length, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }); res.end(bytes); return;
        }
        if (path === "/image-retry" && req.method === "POST") {
          if (req.headers.origin !== "http://" + host || req.headers["x-devotio-profile"] !== user.id || !canManageEditorial(user)) throw new LocalError("Acesso exclusivo da gestão editorial.", 403);
          const input = imageRequestSchema.parse(await body(req)); images.refresh(input.id, true); return send(200, null);
        }
      }
      if (req.method === "GET" && path === "/session") return send(200, { profile: database.session(sessionToken), profiles, expiresAt: database.sessionExpiresAt(sessionToken) });
      if (req.method === "GET" && path === "/events") {
        const user = database.session(sessionToken), expiresAt = database.sessionExpiresAt(sessionToken);
        if (!user || !expiresAt || url.searchParams.get("profile") !== user.id) throw new LocalError("Sua sessão mudou. Entre novamente.", 401);
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
        res.flushHeaders();
        res.write("retry: 10000\n\n");
        const write = (value: unknown) => res.write(`event: notifications\ndata: ${JSON.stringify(value)}\n\n`);
        write(database.notificationSummary(user.id));
        const stop = database.subscribeNotifications(user.id, summary => {
          if (!database.session(sessionToken)) { res.end(); return; }
          write(summary);
        });
        // Transport heartbeat only; no SQLite query while idle.
        const heartbeat = setInterval(() => { if (Date.now() >= expiresAt) res.end(); else res.write(": keepalive\n\n"); }, 25000);
        res.on("close", () => { clearInterval(heartbeat); stop(); });
        return;
      }
      if (req.method === "GET" && path === "/query") {
        const user = database.session(sessionToken);
        if (!user || req.headers["x-devotio-profile"] !== user.id) throw new LocalError("Sua sessão mudou. Entre novamente.", 401);
        let value: unknown;
        try { value = JSON.parse(url.searchParams.get("input") ?? "null"); } catch { throw new LocalError("Consulta inválida."); }
        return send(200, database.query(user, localQuerySchema.parse(value)));
      }
      if (req.method !== "POST" || path !== "/command") throw new LocalError("Operação não encontrada.", 404);
      if (req.headers.origin !== `http://${host}` || !req.headers["content-type"]?.startsWith("application/json")) throw new LocalError("Origem da requisição inválida.", 403);
      const input = localCommandSchema.parse(await body(req));
      if (input.action === "login") {
        if (sessionToken) database.logout(sessionToken);
        const result = database.login(input.profileId);
        cookie(res, result.token, LOCAL_SESSION_SECONDS);
        return send(200, { profile: result.profile, expiresAt: result.expiresAt });
      }
      if (input.action === "logout") {
        if (sessionToken) database.logout(sessionToken);
        cookie(res, "", 0); return send(200, null);
      }
      const user = database.session(sessionToken);
      if (!user || req.headers["x-devotio-profile"] !== user.id) throw new LocalError("Sua sessão mudou. Entre novamente.", 401);
      const result = database.command(user, input);
      if (images && (input.action === "publish" || input.action === "schedule")) images.refresh(input.input.date);
      if (images && input.action === "withdraw") images.refresh(input.date);
      return send(200, result);
    } catch (error) {
      const status = error instanceof LocalError ? error.status : error instanceof ZodError ? 400 : 500;
      if (status === 500) console.error("Falha no backend local:", error);
      send(status, { error: status === 500 ? "Não foi possível concluir a operação local." : validationMessage(error) });
    }
  };
}
