import { gameConfig as C } from "./gameConfig";
export type Field = {
  state: "empty" | "tilled" | "ready";
  readyWeek?: number;
  plantedWeek?: number;
};
export type OrderChoice = "accept" | "decline";
export type Decision = {
  kind: "buy" | "till" | "care";
  stock: number;
  remaining: number;
  growthPossible: boolean;
};
export type Report = {
  week: number;
  delivered: number;
  shortage: number;
  stock: number;
  harvest: number;
  logs: string[];
  decisions?: Decision[];
  unused?: number;
  safeGrowthSkipped?: boolean;
  eventChoice?: string;
  order?: {
    id: string;
    accepted: boolean;
    required: number;
    delivered: number;
    points: number;
  };
};
export type City = {
  name: string;
  stock: number;
  fields: Field[];
  remaining: number;
  purchases: number;
  submitted: boolean;
  delivery: number;
  logs: string[];
  harvest: number;
  reports: Report[];
  decisions?: Decision[];
  eventChoice?: "accept" | "decline";
  orderChoice?: OrderChoice;
  orderDelivery?: number;
  safeGrowthSkipped?: boolean;
};
export type Game = {
  version: 1;
  week: number;
  phase: "lobby" | "actions" | "reveal" | "final";
  cities: City[];
  paused?: boolean;
};
export const eventFor = (week: number) => C.events.find((e) => e.week === week);
export const orderFor = (week: number) => C.orders.find((e) => e.week === week);
export function createGame(count: number, names: string[] = []): Game {
  if (!Number.isInteger(count) || count < 2 || count > 6)
    throw Error("請選擇 2～6 城");
  return {
    version: 1,
    week: 1,
    phase: "lobby",
    cities: Array.from({ length: count }, (_, i) => ({
      name: names[i]?.trim().slice(0, 12) || C.cityNames[i],
      stock: C.initialStock,
      fields: Array.from({ length: C.fields }, () => ({ state: "empty" })),
      remaining: C.actions,
      purchases: 0,
      submitted: false,
      delivery: 0,
      logs: [],
      decisions: [],
      harvest: 0,
      reports: [],
    })),
  };
}
function requirePhase(g: Game, phase: Game["phase"]) {
  if (g.phase !== phase) throw Error("目前階段無法執行此操作");
  if (g.paused) throw Error("關主已暫停遊戲");
}
function editable(g: Game, i: number) {
  requirePhase(g, "actions");
  const c = g.cities[i];
  if (!c || c.submitted) throw Error("城市已提交或不存在");
  return c;
}
export function start(g: Game): Game {
  requirePhase(g, "lobby");
  return { ...g, phase: "actions" };
}
export const canCare = (field: Field, week: number) =>
  field.state === "tilled" &&
  field.plantedWeek !== undefined &&
  week >= field.plantedWeek + C.careDelayWeeks;
const growthPossible = (c: City, week: number) =>
  c.fields.some(
    (f) =>
      (canCare(f, week) && week + 1 <= C.weeks) ||
      (f.state === "empty" && week + C.careDelayWeeks + 1 <= C.weeks),
  );
export function chooseEvent(
  g: Game,
  i: number,
  choice: "accept" | "decline",
): Game {
  const c = editable(g, i),
    event = eventFor(g.week);
  if (
    !event?.choice ||
    c.eventChoice ||
    (c.decisions?.length ?? 0) > 0 ||
    c.remaining !== (event.actions ?? C.actions)
  )
    throw Error("事件須在本週農務開始前選擇一次");
  if (!["accept", "decline"].includes(choice)) throw Error("無效事件選項");
  const n = structuredClone(g),
    city = n.cities[i];
  city.eventChoice = choice;
  if (choice === "accept") {
    city.stock += event.choice.stock;
    city.remaining += event.choice.actions;
  }
  city.logs.push(
    `${event.title}：${choice === "accept" ? "協助鄰村" : "維持原計畫"}`,
  );
  return n;
}
export function chooseOrder(g: Game, i: number, choice: OrderChoice): Game {
  const c = editable(g, i);
  if (
    !orderFor(g.week) ||
    !["accept", "decline"].includes(choice) ||
    c.orderChoice
  )
    throw Error("訂單只能選擇一次");
  const n = structuredClone(g);
  n.cities[i].orderChoice = choice;
  n.cities[i].logs.push(choice === "accept" ? "接受臨時訂單" : "婉拒臨時訂單");
  return n;
}
export function action(
  g: Game,
  index: number,
  kind: "buy" | "till" | "care",
  fieldIndex?: number,
): Game {
  const original = editable(g, index);
  if (!["buy", "till", "care"].includes(kind)) throw Error("無效行動");
  if (original.remaining <= 0) throw Error("沒有可用行動");
  if (eventFor(g.week)?.choice && !original.eventChoice)
    throw Error("請先選擇本週事件");
  const n = structuredClone(g),
    c = n.cities[index];
  const decision: Decision = {
    kind,
    stock: c.stock,
    remaining: c.remaining,
    growthPossible: growthPossible(c, g.week),
  };
  if (kind === "buy") {
    if (c.purchases >= C.purchaseLimit) throw Error("本週採買已達上限");
    const boxes = eventFor(g.week)?.purchaseBoxes ?? C.purchaseBoxes;
    c.stock += boxes;
    c.purchases++;
    c.logs.push(`採買 ${boxes} 箱`);
  } else {
    if (!Number.isInteger(fieldIndex)) throw Error("請指定農田");
    const f = c.fields[fieldIndex ?? -1];
    if (!f || (kind === "till" ? f.state !== "empty" : f.state !== "tilled"))
      throw Error("田地狀態不允許此操作");
    if (kind === "care" && !canCare(f, g.week))
      throw Error("本週播種的田地，最早下一週才能照料");
    if (kind === "till") f.plantedWeek = g.week;
    f.state = kind === "till" ? "tilled" : "ready";
    if (kind === "care") f.readyWeek = g.week + 1;
    c.logs.push(
      `${kind === "till" ? "播種" : "照料"}${String.fromCharCode(65 + fieldIndex!)}田`,
    );
  }
  c.decisions = [...(c.decisions ?? []), decision];
  c.remaining--;
  return n;
}
export function submit(
  g: Game,
  index: number,
  boxes: number,
  orderBoxes = 0,
): Game {
  const original = editable(g, index);
  if (eventFor(g.week)?.choice && !original.eventChoice)
    throw Error("請先選擇本週事件");
  const order = orderFor(g.week);
  if (order && !original.orderChoice) throw Error("請先接受或婉拒臨時訂單");
  if (
    !Number.isInteger(boxes) ||
    !Number.isInteger(orderBoxes) ||
    boxes < 0 ||
    orderBoxes < 0 ||
    boxes + orderBoxes > original.stock
  )
    throw Error("交付須為庫存範圍內的整數，正常交付與訂單不可重複使用糧食");
  if (
    orderBoxes > (order?.boxes ?? 0) ||
    (orderBoxes > 0 && original.orderChoice !== "accept")
  )
    throw Error("未接單或訂單交付超額");
  const n = structuredClone(g),
    c = n.cities[index];
  c.safeGrowthSkipped =
    boxes >= C.weeklyDelivery &&
    c.stock - boxes - orderBoxes >= C.assessment.safeStock &&
    c.remaining >= C.assessment.unusedActions &&
    growthPossible(c, g.week);
  c.delivery = boxes;
  c.orderDelivery = orderBoxes;
  c.stock -= boxes + orderBoxes;
  c.submitted = true;
  return n;
}
export function reveal(g: Game): Game {
  requirePhase(g, "actions");
  if (!g.cities.every((c) => c.submitted)) throw Error("請等待所有城市提交");
  const n = structuredClone(g);
  n.phase = "reveal";
  const order = orderFor(g.week);
  n.cities.forEach((c) =>
    c.reports.push({
      week: g.week,
      delivered: c.delivery,
      shortage: Math.max(0, C.weeklyDelivery - c.delivery),
      stock: c.stock,
      harvest: c.harvest,
      logs: [...c.logs],
      decisions: c.decisions ?? [],
      unused: c.remaining,
      safeGrowthSkipped: c.safeGrowthSkipped,
      eventChoice: c.eventChoice,
      order: order
        ? {
            id: order.id,
            accepted: c.orderChoice === "accept",
            required: order.boxes,
            delivered: c.orderDelivery ?? 0,
            points:
              c.orderChoice !== "accept"
                ? 0
                : c.orderDelivery === order.boxes
                  ? order.reward
                  : -order.penalty,
          }
        : undefined,
    }),
  );
  return n;
}
export function advance(g: Game): Game {
  requirePhase(g, "reveal");
  const n = structuredClone(g);
  if (n.week === C.weeks) {
    n.phase = "final";
    return n;
  }
  n.week++;
  n.phase = "actions";
  n.cities.forEach((c) => {
    c.harvest = 0;
    c.fields.forEach((f) => {
      if (f.state === "ready" && f.readyWeek! <= n.week) {
        c.harvest += C.harvestBoxes;
        f.state = "empty";
        delete f.readyWeek;
        delete f.plantedWeek;
      }
    });
    c.stock += c.harvest;
    c.remaining = eventFor(n.week)?.actions ?? C.actions;
    c.purchases = 0;
    c.submitted = false;
    c.delivery = 0;
    c.logs = [];
    c.decisions = [];
    delete c.eventChoice;
    delete c.orderChoice;
    delete c.orderDelivery;
    delete c.safeGrowthSkipped;
  });
  return n;
}
export function setPaused(g: Game, paused: boolean): Game {
  if (g.phase !== "actions") throw Error("只能在經營階段暫停");
  return { ...g, paused };
}
export function reopen(g: Game, snapshot: Game): Game {
  if (
    g.phase !== "actions" ||
    snapshot.week !== g.week ||
    snapshot.phase !== "actions"
  )
    throw Error("已公開週報不可重開；只能重開當週未公布的回合");
  return { ...structuredClone(snapshot), paused: true };
}
export function monthTotal(c: City, month: number) {
  return c.reports
    .filter((r) => Math.floor((r.week - 1) / C.weeksPerMonth) === month)
    .reduce((a, r) => a + r.delivered, 0);
}
export function score(c: City) {
  const s = C.scoring,
    total = c.reports.reduce((a, r) => a + r.delivered, 0),
    shortage = c.reports.reduce((a, r) => a + r.shortage, 0);
  const delivery =
    (C.monthlyTargets.reduce(
      (a, t, i) => a + Math.min(1, monthTotal(c, i) / t),
      0,
    ) /
      2) *
    s.deliveryWeight;
  const growth =
    Math.min(1, Math.max(0, total - C.weeks * C.weeklyDelivery) / s.growthCap) *
    s.growthWeight;
  const reserve =
    Math.min(
      1,
      (c.stock +
        c.fields.filter((f) => f.state !== "empty").length *
          s.futureFieldValue) /
        s.stockCap,
    ) * s.reserveWeight;
  const orderPoints = c.reports.reduce((a, r) => a + (r.order?.points ?? 0), 0);
  const resilience = Math.min(
    s.resilienceWeight,
    Math.max(
      0,
      s.resilienceWeight - shortage * s.shortagePenalty + orderPoints,
    ),
  );
  return {
    delivery,
    growth,
    reserve,
    resilience,
    total: Math.round((delivery + growth + reserve + resilience) * 10) / 10,
  };
}
