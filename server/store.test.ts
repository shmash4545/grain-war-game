import { describe, it, expect } from "vitest";
import { RoomStore } from "./store";
import type { Command } from "../src/protocol";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
describe("權威房間服務", () => {
  for (const count of [2, 6])
    it(`${count} 城完整八週；揭曉前只收到自己的資料`, () => {
      const store = new RoomStore(":memory:");
      try {
        const h = store.create(count, []),
          cities = Array.from({ length: count }, (_, i) =>
            store.join(h.code, i),
          );
        const command = (s: typeof h, cmd: Command) =>
          store.command(
            s.code,
            s.token,
            s.lease,
            store.view(s.code, s.token, s.lease).revision,
            randomUUID(),
            cmd,
          );
        expect(() => command(cities[0], { type: "start" })).toThrow("只有關主");
        expect(() => command(h, { type: "action", kind: "buy" })).toThrow(
          "不能代替",
        );
        command(h, { type: "start" });
        for (let w = 1; w <= 8; w++) {
          for (const c of cities) {
            if (w === 5) command(c, { type: "event", choice: "decline" });
            if ([4, 7].includes(w))
              command(c, { type: "order", choice: "decline" });
            command(c, { type: "action", kind: "buy" });
            const own = store.view(c.code, c.token, c.lease);
            expect(own.ownCity?.stock).toBeGreaterThan(0);
            expect(
              (own as unknown as Record<string, unknown>).game,
            ).toBeUndefined();
            expect(
              (own as unknown as Record<string, unknown>).cities,
            ).toBeUndefined();
            command(c, { type: "submit", boxes: 0, orderBoxes: 0 });
          }
          const hidden = store.view(h.code, h.token, h.lease);
          expect(hidden.ownCity).toBeUndefined();
          expect(hidden.statuses[0]).not.toHaveProperty("stock");
          if (w === 1) expect(hidden.published).toBeNull();
          else expect(hidden.published![0].reports.at(-1)?.week).toBe(w - 1);
          command(h, { type: "reveal" });
          expect(
            store.view(h.code, h.token, h.lease).published![0].reports.at(-1)
              ?.week,
          ).toBe(w);
          expect(() => command(h, { type: "reopen" })).toThrow();
          command(h, { type: "advance" });
        }
        expect(store.view(h.code, h.token, h.lease).phase).toBe("final");
      } finally {
        store.close();
      }
    });
  it("重送只執行一次、舊 revision 拒絕、同 ID 不同內容拒絕", () => {
    const s = new RoomStore(":memory:");
    try {
      const h = s.create(2, []),
        a = s.join(h.code, 0);
      s.join(h.code, 1);
      let v = s.view(h.code, h.token, h.lease);
      s.command(h.code, h.token, h.lease, v.revision, randomUUID(), {
        type: "start",
      });
      v = s.view(a.code, a.token, a.lease);
      const id = randomUUID();
      s.command(a.code, a.token, a.lease, v.revision, id, {
        type: "action",
        kind: "buy",
      });
      expect(
        s.command(a.code, a.token, a.lease, v.revision, id, {
          type: "action",
          kind: "buy",
        }).replayed,
      ).toBe(true);
      expect(s.view(a.code, a.token, a.lease).ownCity?.stock).toBe(10);
      expect(() =>
        s.command(a.code, a.token, a.lease, v.revision, randomUUID(), {
          type: "action",
          kind: "buy",
        }),
      ).toThrow("更新");
      expect(() =>
        s.command(a.code, a.token, a.lease, v.revision, id, {
          type: "action",
          kind: "till",
          field: 0,
        }),
      ).toThrow("不得更改");
    } finally {
      s.close();
    }
  });
  it("佔城、憑證、單操作端、暫停、重開全城與舊請求隔離", () => {
    const s = new RoomStore(":memory:");
    try {
      const h = s.create(2, []),
        a = s.join(h.code, 0);
      s.join(h.code, 1);
      expect(() => s.join(h.code, 0)).toThrow("已有人");
      expect(() => s.view(h.code, "fake", "fake")).toThrow();
      const lease = s.resume(a.code, a.token).lease;
      expect(() => s.view(a.code, a.token, a.lease)).toThrow("操作權");
      a.lease = lease;
      const send = (c: typeof h, command: Command) =>
        s.command(
          c.code,
          c.token,
          c.lease,
          s.view(c.code, c.token, c.lease).revision,
          randomUUID(),
          command,
        );
      send(h, { type: "start" });
      send(a, { type: "action", kind: "buy" });
      send(a, { type: "submit", boxes: 6, orderBoxes: 0 });
      const old = s.view(a.code, a.token, a.lease).revision;
      send(h, { type: "pause" });
      expect(() => send(a, { type: "action", kind: "buy" })).toThrow("暫停");
      send(h, { type: "reopen" });
      let own = s.view(a.code, a.token, a.lease);
      expect(own.paused).toBe(true);
      expect(own.ownCity?.stock).toBe(8);
      expect(own.ownCity?.submitted).toBe(false);
      send(h, { type: "resume" });
      expect(() =>
        s.command(a.code, a.token, a.lease, old, randomUUID(), {
          type: "action",
          kind: "buy",
        }),
      ).toThrow("更新");
      send(a, { type: "action", kind: "buy" });
    } finally {
      s.close();
    }
  });
  it("服務重啟後保留房間、憑證、提交及去重紀錄", () => {
    const dir = mkdtempSync(join(tmpdir(), "grain-")),
      file = join(dir, "rooms.sqlite");
    let s = new RoomStore(file);
    try {
      const h = s.create(2, []),
        a = s.join(h.code, 0);
      s.join(h.code, 1);
      s.command(
        h.code,
        h.token,
        h.lease,
        s.view(h.code, h.token, h.lease).revision,
        randomUUID(),
        { type: "start" },
      );
      const revision = s.view(a.code, a.token, a.lease).revision,
        id = randomUUID(),
        cmd: Command = { type: "submit", boxes: 6, orderBoxes: 0 };
      s.command(a.code, a.token, a.lease, revision, id, cmd);
      s.close();
      s = new RoomStore(file);
      expect(s.view(a.code, a.token, a.lease).ownCity?.stock).toBe(2);
      expect(s.view(a.code, a.token, a.lease).ownCity?.submitted).toBe(true);
      expect(
        s.command(a.code, a.token, a.lease, revision, id, cmd).replayed,
      ).toBe(true);
    } finally {
      s.close();
      rmSync(dir, { recursive: true });
    }
  });
});
