import { it, expect } from "vitest";
import { createApp } from "./app";
import { RoomStore } from "./store";
import { randomUUID } from "node:crypto";
it("HTTP API、CORS 與授權串流：SSE 不洩漏隱藏資料，重新連線可恢復", async () => {
  const store = new RoomStore(":memory:"),
    server = createApp(store, ["https://example.test"]);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address() as { port: number },
    base = `http://127.0.0.1:${addr.port}`;
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const bad = await fetch(base + "/api/rooms", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.test" },
    });
    expect(bad.status).toBe(403);
    const preflight = await fetch(base + "/api/rooms", {
      method: "OPTIONS",
      headers: { Origin: "https://example.test" },
    });
    expect(preflight.headers.get("access-control-allow-origin")).toBe(
      "https://example.test",
    );
    const create = await fetch(base + "/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 2, names: [] }),
    });
    const host = await create.json();
    expect(create.status).toBe(201);
    const headers = {
      Authorization: `Bearer ${host.token}`,
      "X-Lease": host.lease,
      "Content-Type": "application/json",
    };
    const invalid = await fetch(`${base}/api/rooms/${host.code}/view`);
    expect(invalid.status).toBe(401);
    const stream = await fetch(`${base}/api/rooms/${host.code}/events`, {
      headers,
      signal: controller.signal,
    });
    expect(stream.headers.get("content-type")).toBe("text/event-stream");
    reader = stream.body!.getReader();
    let text = "";
    while (!text.includes("\n\n"))
      text += new TextDecoder().decode((await reader.read()).value);
    const view = JSON.parse(text.split("data: ")[1].split("\n\n")[0]);
    expect(view.published).toBeNull();
    expect(view.ownCity).toBeUndefined();
    expect(view.statuses[0]).not.toHaveProperty("stock");
    expect(text).not.toContain(host.token);
    const wrong = await fetch(`${base}/api/rooms/${host.code}/command`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: randomUUID(),
        revision: view.revision,
        command: { type: "action", kind: "buy", index: 0 },
      }),
    });
    expect(wrong.status).toBe(403);
    const resumed = await (
      await fetch(`${base}/api/rooms/${host.code}/resume`, {
        method: "POST",
        headers,
        body: "{}",
      })
    ).json();
    expect(resumed.lease).not.toBe(host.lease);
    const stale = await fetch(`${base}/api/rooms/${host.code}/view`, {
      headers,
    });
    expect(stale.status).toBe(409);
    const fresh = await fetch(`${base}/api/rooms/${host.code}/view`, {
      headers: { ...headers, "X-Lease": resumed.lease },
    });
    expect(fresh.status).toBe(200);
  } finally {
    controller.abort();
    await reader?.cancel().catch(() => {});
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    store.close();
  }
}, 10000);
