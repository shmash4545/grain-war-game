import { describe, it, expect } from "vitest";
import {
  createGame,
  start,
  action,
  submit,
  chooseEvent,
  chooseOrder,
  reveal,
  advance,
  setPaused,
  reopen,
  score,
  monthTotal,
} from "./gameEngine";
import { assess } from "./assessment";
const next = (g: ReturnType<typeof createGame>) => {
  for (let i = 0; i < g.cities.length; i++) {
    if (g.week === 5) g = chooseEvent(g, i, "decline");
    if ([4, 7].includes(g.week)) g = chooseOrder(g, i, "decline");
    g = submit(g, i, 0);
  }
  return advance(reveal(g));
};
const at = (week: number) => {
  let g = start(createGame(2));
  while (g.week < week) g = next(g);
  return g;
};
describe("事件、訂單與控場", () => {
  it("事件在農務前選擇一次，不回溯改變收成", () => {
    let g = at(5);
    expect(() => action(g, 0, "buy")).toThrow("先選擇");
    const stock = g.cities[0].stock;
    g = chooseEvent(g, 0, "accept");
    expect(g.cities[0].stock).toBe(stock + 3);
    expect(g.cities[0].remaining).toBe(3);
    expect(() => chooseEvent(g, 0, "accept")).toThrow();
    g = action(g, 0, "buy");
    expect(g.cities[0].decisions).toHaveLength(1);
  });
  it("訂單交付與月目標分帳，庫存只扣一次", () => {
    let g = at(4);
    g = chooseOrder(g, 0, "accept");
    g = submit(g, 0, 4, 4);
    expect(g.cities[0].stock).toBe(0);
    g = chooseOrder(g, 1, "decline");
    g = submit(g, 1, 0);
    g = reveal(g);
    expect(monthTotal(g.cities[0], 0)).toBe(4);
    expect(g.cities[0].reports[3].order).toMatchObject({
      delivered: 4,
      points: 3,
    });
    expect(score(g.cities[0]).resilience).toBeGreaterThanOrEqual(0);
    expect(() => submit(g, 0, 0, 0)).toThrow();
  });
  it("接單未足額扣分，拒單不扣分；禁止重複選擇和超額交付", () => {
    let g = at(4);
    expect(() => submit(g, 0, 1)).toThrow("先接受");
    g = chooseOrder(g, 0, "accept");
    expect(() => chooseOrder(g, 0, "decline")).toThrow();
    expect(() => submit(g, 0, 6, 4)).toThrow("庫存");
    expect(() => submit(g, 0, 0, 5)).toThrow("超額");
    g = submit(g, 0, 6, 2);
    g = chooseOrder(g, 1, "decline");
    expect(() => submit(g, 1, 0, 1)).toThrow();
    g = reveal(submit(g, 1, 0));
    expect(g.cities[0].reports[3].order?.points).toBe(-2);
    expect(g.cities[1].reports[3].order?.points).toBe(0);
  });
  it("暫停阻止所有城市操作，重開還原全城並保持暫停，已公布不能重開", () => {
    const snapshot = start(createGame(2));
    let g = action(snapshot, 0, "buy");
    g = submit(g, 0, 6);
    g = setPaused(g, true);
    expect(() => action(g, 1, "buy")).toThrow("暫停");
    expect(() => submit(g, 1, 0)).toThrow("暫停");
    g = reopen(g, snapshot);
    expect(g.paused).toBe(true);
    expect(g.cities[0].stock).toBe(8);
    expect(g.cities[0].submitted).toBe(false);
    g = setPaused(g, false);
    g = reveal(submit(submit(g, 0, 0), 1, 0));
    expect(() => reopen(g, snapshot)).toThrow();
  });
});
describe("風格鑑定", () => {
  it("高庫存或拒單不能單獨判守成；觀察不足保守顯示", () => {
    const c = createGame(2).cities[0];
    c.stock = 100;
    expect(assess(c).main).toBeNull();
    expect(assess(c).evidence[0]).toContain("證據不足");
  });
  it("多週投入與交付雙重證據產生風格、建議及實際指標", () => {
    const c = createGame(2).cities[0];
    c.reports = Array.from({ length: 8 }, (_, i) => ({
      week: i + 1,
      delivered: 8,
      shortage: 0,
      stock: 3,
      harvest: 7,
      logs: [],
      unused: 0,
      decisions: [
        { kind: "till" as const, stock: 9, remaining: 4, growthPossible: true },
        { kind: "care" as const, stock: 9, remaining: 3, growthPossible: true },
      ],
    }));
    const a = assess(c);
    expect(a.main).not.toBeNull();
    expect(a.main?.name).not.toBe("守成型");
    expect(a.secondary).not.toBeNull();
    expect(a.evidence).toHaveLength(2);
    expect(a.indicators.stability).toBe(100);
    expect(a.advice.length).toBeGreaterThan(10);
  });
  it("守成需多次有安全庫存、可成長農田及行動餘裕的實際記錄", () => {
    const c = createGame(2).cities[0];
    c.reports = Array.from({ length: 8 }, (_, i) => ({
      week: i + 1,
      delivered: 6,
      shortage: 0,
      stock: 10,
      harvest: 0,
      logs: [],
      safeGrowthSkipped: true,
      unused: 3,
      decisions: [
        { kind: "buy" as const, stock: 8, remaining: 4, growthPossible: true },
      ],
    }));
    expect(assess(c).main?.name).toBe("守成型");
  });
});
