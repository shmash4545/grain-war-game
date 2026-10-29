import { useEffect, useRef, useState } from "react";
import type { Session, RoomView, Command } from "./protocol";
export const initialApi = () => {
  try {
    return (
      import.meta.env.VITE_API_URL ||
      localStorage.getItem("grain-api") ||
      "http://localhost:3001"
    );
  } catch {
    return import.meta.env.VITE_API_URL || "http://localhost:3001";
  }
};
export function apiAddress(value: string) {
  const u = new URL(value.trim());
  if (
    u.protocol !== "https:" &&
    !(u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname))
  )
    throw Error("伺服器須使用 HTTPS，本機開發可使用 http://localhost");
  if (u.username || u.password || u.search || u.hash)
    throw Error("伺服器網址格式錯誤");
  return u.href.replace(/\/$/, "");
}
export async function request(
  api: string,
  path: string,
  options: {
    body?: unknown;
    token?: string;
    lease?: string;
    signal?: AbortSignal;
  } = {},
) {
  const res = await fetch(`${api}/api/rooms${path}`, {
    method: options.body !== undefined ? "POST" : "GET",
    signal: options.signal,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.lease ? { "X-Lease": options.lease } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await res.json();
  if (!res.ok) throw Error(data.error ?? "無法連線");
  return data;
}
export function useRoom(api: string, session: Session) {
  const [view, setView] = useState<RoomView | null>(null),
    [status, setStatus] = useState("連線中"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [generation, setGeneration] = useState(0);
  const lease = useRef(""),
    current = useRef<RoomView | null>(null),
    pending = useRef<{ id: string; revision: number; command: Command } | null>(
      null,
    );
  const accept = (v: RoomView) => {
    if (!current.current || v.revision >= current.current.revision) {
      current.current = v;
      setView(v);
    }
  };
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const connect = async () => {
      try {
        if (!lease.current) {
          const data = await request(api, `/${session.code}/resume`, {
            body: {},
            token: session.token,
            signal: controller.signal,
          });
          lease.current = data.lease;
        }
        const res = await fetch(`${api}/api/rooms/${session.code}/events`, {
          headers: {
            Authorization: `Bearer ${session.token}`,
            "X-Lease": lease.current,
          },
          signal: controller.signal,
        });
        if (!res.ok) {
          const d = await res.json();
          setStatus(res.status === 409 ? "操作權已轉移" : "驗證失敗");
          setError(d.error);
          return;
        }
        setStatus("即時連線");
        const reader = res.body!.getReader(),
          decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let end;
          while ((end = buffer.indexOf("\n\n")) >= 0) {
            const frame = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            if (frame.startsWith("data: ")) accept(JSON.parse(frame.slice(6)));
          }
        }
        if (!controller.signal.aborted) {
          setStatus("重新連線中");
          timer = setTimeout(connect, 1500);
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setStatus("離線，正在重連");
          timer = setTimeout(connect, 2000);
        }
      }
    };
    connect();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [api, session.code, session.token, generation]);
  const send = async (command?: Command) => {
    if (busy || !current.current) return;
    const payload = pending.current ?? {
      id: crypto.randomUUID(),
      revision: current.current.revision,
      command: command!,
    };
    if (!payload.command) return;
    pending.current = payload;
    setBusy(true);
    setError("");
    try {
      await request(api, `/${session.code}/command`, {
        body: payload,
        token: session.token,
        lease: lease.current,
      });
      pending.current = null;
      setUncertain(false);
      accept(
        await request(api, `/${session.code}/view`, {
          token: session.token,
          lease: lease.current,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
      try {
        accept(
          await request(api, `/${session.code}/view`, {
            token: session.token,
            lease: lease.current,
          }),
        );
        pending.current = null;
        setUncertain(false);
      } catch {
        setUncertain(true);
      }
    } finally {
      setBusy(false);
    }
  };
  return {
    view,
    status,
    error,
    busy,
    uncertain,
    send,
    retry: () => send(),
    reclaim: () => {
      lease.current = "";
      setGeneration((v) => v + 1);
    },
  };
}
