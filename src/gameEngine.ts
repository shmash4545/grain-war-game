import { gameConfig as C } from './gameConfig';
export type Field = { state: 'empty' | 'tilled' | 'ready'; readyWeek?: number; plantedWeek?: number };
export type Report = { week: number; delivered: number; shortage: number; stock: number; harvest: number; logs: string[] };
export type City = { name: string; stock: number; fields: Field[]; remaining: number; purchases: number; submitted: boolean; delivery: number; logs: string[]; harvest: number; reports: Report[] };
export type Game = { version: 1; week: number; phase: 'lobby' | 'actions' | 'reveal' | 'final'; cities: City[] };
export const eventFor = (week: number) => C.events.find(e => e.week === week);
export function createGame(count: number, names: string[] = []): Game {
  if (!Number.isInteger(count) || count < 2 || count > 6) throw Error('請選擇 2～6 城');
  return { version: 1, week: 1, phase: 'lobby', cities: Array.from({ length: count }, (_, i) => ({ name: names[i]?.trim().slice(0, 12) || C.cityNames[i], stock: C.initialStock, fields: Array.from({ length: C.fields }, () => ({ state: 'empty' })), remaining: C.actions, purchases: 0, submitted: false, delivery: 0, logs: [], harvest: 0, reports: [] })) };
}
function requirePhase(g: Game, phase: Game['phase']) { if (g.phase !== phase) throw Error('目前階段無法執行此操作'); }
export function start(g: Game): Game { requirePhase(g, 'lobby'); return { ...g, phase: 'actions' }; }
export const canCare = (field: Field, week: number) => field.state === 'tilled' && field.plantedWeek !== undefined && week >= field.plantedWeek + C.careDelayWeeks;
export function action(g: Game, index: number, kind: 'buy' | 'till' | 'care', fieldIndex?: number): Game {
  requirePhase(g, 'actions'); const n = structuredClone(g); const c = n.cities[index];
  if (!c || c.submitted || c.remaining <= 0) throw Error('沒有可用行動，或已經提交');
  if (kind === 'buy') {
    if (c.purchases >= C.purchaseLimit) throw Error('本週採買已達上限');
    const boxes = eventFor(g.week)?.purchaseBoxes ?? C.purchaseBoxes;
    c.stock += boxes; c.purchases++; c.logs.push(`採買 ${boxes} 箱`);
  } else {
    const f = c.fields[fieldIndex ?? -1];
    if (!f || (kind === 'till' ? f.state !== 'empty' : f.state !== 'tilled')) throw Error('田地狀態不允許此操作');
    if (kind === 'care' && !canCare(f, g.week)) throw Error('本週播種的田地，最早下一週才能照料');
    if (kind === 'till') f.plantedWeek = g.week;
    f.state = kind === 'till' ? 'tilled' : 'ready';
    if (kind === 'care') f.readyWeek = g.week + 1;
    c.logs.push(`${kind === 'till' ? '播種' : '照料'}${String.fromCharCode(65 + fieldIndex!)}田`);
  }
  c.remaining--; return n;
}
export function submit(g: Game, index: number, boxes: number): Game {
  requirePhase(g, 'actions'); const n = structuredClone(g); const c = n.cities[index];
  if (!c || c.submitted) throw Error('城市已提交或不存在');
  if (!Number.isInteger(boxes) || boxes < 0 || boxes > c.stock) throw Error('交付量須為庫存範圍內的整數');
  c.delivery = boxes; c.stock -= boxes; c.submitted = true; return n;
}
export function reveal(g: Game): Game {
  requirePhase(g, 'actions'); if (!g.cities.every(c => c.submitted)) throw Error('請等待所有城市提交');
  const n = structuredClone(g); n.phase = 'reveal';
  n.cities.forEach(c => c.reports.push({ week: g.week, delivered: c.delivery, shortage: Math.max(0, C.weeklyDelivery - c.delivery), stock: c.stock, harvest: c.harvest, logs: [...c.logs] })); return n;
}
export function advance(g: Game): Game {
  requirePhase(g, 'reveal'); const n = structuredClone(g);
  if (n.week === C.weeks) { n.phase = 'final'; return n; }
  n.week++; n.phase = 'actions';
  n.cities.forEach(c => {
    c.harvest = 0; c.fields.forEach(f => { if (f.state === 'ready' && f.readyWeek! <= n.week) { c.harvest += C.harvestBoxes; f.state = 'empty'; delete f.readyWeek; delete f.plantedWeek; } });
    c.stock += c.harvest; c.remaining = eventFor(n.week)?.actions ?? C.actions; c.purchases = 0; c.submitted = false; c.delivery = 0; c.logs = [];
  }); return n;
}
export function monthTotal(c: City, month: number) { return c.reports.filter(r => Math.floor((r.week - 1) / C.weeksPerMonth) === month).reduce((a, r) => a + r.delivered, 0); }
export function score(c: City) {
  const s = C.scoring, total = c.reports.reduce((a, r) => a + r.delivered, 0), shortage = c.reports.reduce((a, r) => a + r.shortage, 0);
  const delivery = C.monthlyTargets.reduce((a, t, i) => a + Math.min(1, monthTotal(c, i) / t), 0) / 2 * s.deliveryWeight;
  const growth = Math.min(1, Math.max(0, total - C.weeks * C.weeklyDelivery) / s.growthCap) * s.growthWeight;
  const reserve = Math.min(1, (c.stock + c.fields.filter(f => f.state !== 'empty').length * s.futureFieldValue) / s.stockCap) * s.reserveWeight;
  const resilience = Math.max(0, s.resilienceWeight - shortage * s.shortagePenalty);
  return { delivery, growth, reserve, resilience, total: Math.round((delivery + growth + reserve + resilience) * 10) / 10 };
}
