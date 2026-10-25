import { createServer, type ServerResponse } from "node:http";
import { RoomStore, RoomError } from "./store";
import type { Role, Command } from "../src/protocol";
type Stream = {
  code: string;
  token: string;
  lease: string;
  role: Role;
  res: ServerResponse;
};
export function createApp(store: RoomStore, allowedOrigins: string[]) {
  const streams = new Set<Stream>();
  const limits = new Map<string, { at: number; n: number }>();
  const online = (code: string, i: number) =>
    [...streams].some(
      (s) => s.code === code && s.role.type === "city" && s.role.index === i,
    );
  const push = (s: Stream) => {
    try {
      s.res.write(
        `data: ${JSON.stringify(store.view(s.code, s.token, s.lease, (i) => online(s.code, i)))}\n\n`,
      );
    } catch {
      s.res.end();
      streams.delete(s);
    }
  };
  const broadcast = (code: string) => {
    for (const s of streams) if (s.code === code) push(s);
  };
  const timer = setInterval(() => {
    for (const s of streams) s.res.write(": heartbeat\n\n");
    const now = Date.now();
    for (const [k, v] of limits) if (now - v.at > 60000) limits.delete(k);
  }, 15000);
  timer.unref();
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Lease",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const json = (status: number, data: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(data));
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    try {
      const address = req.socket.remoteAddress ?? "unknown",
        limit = limits.get(address) ?? { at: Date.now(), n: 0 };
      if (Date.now() - limit.at > 60000) {
        limit.at = Date.now();
        limit.n = 0;
      }
      limits.set(address, limit);
      if (++limit.n > 500) throw new RoomError("操作太頻繁，請稍後再試", 429);
      const url = new URL(req.url ?? "/", "http://server");
      if (req.method === "GET" && url.pathname === "/health") {
        json(200, { ok: true });
        return;
      }
      const token = (req.headers.authorization ?? "").replace(/^Bearer /, ""),
        lease = String(req.headers["x-lease"] ?? "");
      const body = async () => {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 16000) throw new RoomError("請求過大", 413);
        }
        try {
          return JSON.parse(raw);
        } catch {
          throw new RoomError("無效 JSON");
        }
      };
      if (req.method === "POST" && url.pathname === "/api/rooms") {
        const b = await body();
        if (
          !Array.isArray(b.names) ||
          b.names.some((s: unknown) => typeof s !== "string")
        )
          throw new RoomError("城市名稱格式錯誤");
        json(201, store.create(b.count, b.names));
        return;
      }
      const match =
        /^\/api\/rooms\/(\d{6})\/(lobby|join|resume|view|events|command)$/.exec(
          url.pathname,
        );
      if (!match) throw new RoomError("找不到服務", 404);
      const [, code, route] = match;
      if (req.method === "GET" && route === "lobby") {
        json(200, store.lobby(code));
        return;
      }
      if (req.method === "POST" && route === "join") {
        const b = await body();
        const session = store.join(code, b.index);
        broadcast(code);
        json(201, session);
        return;
      }
      if (req.method === "POST" && route === "resume") {
        const result = store.resume(code, token);
        broadcast(code);
        json(200, result);
        return;
      }
      if (req.method === "GET" && route === "view") {
        json(
          200,
          store.view(code, token, lease, (i) => online(code, i)),
        );
        return;
      }
      if (req.method === "GET" && route === "events") {
        const view = store.view(code, token, lease);
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        const stream: Stream = { code, token, lease, role: view.role, res };
        streams.add(stream);
        broadcast(code);
        res.on("close", () => {
          streams.delete(stream);
          broadcast(code);
        });
        return;
      }
      if (req.method === "POST" && route === "command") {
        const b = await body();
        const result = store.command(
          code,
          token,
          lease,
          b.revision,
          b.id,
          b.command as Command,
        );
        broadcast(code);
        json(200, result);
        return;
      }
      throw new RoomError("不支援此方法", 405);
    } catch (e) {
      if (res.headersSent) {
        res.end();
        return;
      }
      json(e instanceof RoomError ? e.status : 400, {
        error: e instanceof Error ? e.message : "操作失敗",
      });
    }
  });
  server.on("close", () => {
    clearInterval(timer);
    for (const s of streams) s.res.end();
    streams.clear();
  });
  return server;
}
