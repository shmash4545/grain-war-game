import { gameConfig as C } from "./gameConfig";
import { type City, eventFor } from "./gameEngine";
export const archetypes = [
  {
    name: "精算型",
    figure: "諸葛亮",
    color: "#3e6c79",
    advice: "把月目標缺口拆到每週，預留一塊田應對意外。",
  },
  {
    name: "開拓型",
    figure: "曹操",
    color: "#a15c44",
    advice: "擴張同時留出基本交付的緩衝，避免產能尚未成熟就接單。",
  },
  {
    name: "穩健型",
    figure: "德川家康",
    color: "#53764c",
    advice: "保持安全庫存，挑選有把握的機會，把穩定轉成成長。",
  },
  {
    name: "應變型",
    figure: "司馬懿",
    color: "#71638e",
    advice: "記下事件前後的取捨，區分有效調整與單純增加操作。",
  },
  {
    name: "守成型",
    figure: "漢文帝",
    color: "#a18442",
    advice: "在庫存安全且有行動餘裕時，試著投入一塊能在期內收成的田。",
  },
];
export function assess(c: City) {
  const cfg = C.assessment;
  const decisions = c.reports.flatMap((r) => r.decisions ?? []);
  const farming = decisions.filter((d) => d.kind !== "buy").length;
  const stable = c.reports.filter(
    (r) => r.shortage === 0 && r.stock >= cfg.stabilityStock,
  ).length;
  const full = c.reports.filter((r) => r.shortage === 0).length;
  const adapted = c.reports.filter(
    (r) =>
      eventFor(r.week) &&
      r.shortage === 0 &&
      (r.decisions?.some((d) => d.kind !== "buy") ?? false),
  ).length;
  const safeSkips = c.reports.filter((r) => r.safeGrowthSkipped).length;
  const fulfilled = c.reports.filter(
    (r) => r.order?.accepted && r.order.delivered === r.order.required,
  ).length;
  const used = c.reports.filter((r) => r.unused === 0).length;
  const extra = c.reports.filter((r) => r.delivered > C.weeklyDelivery).length;
  const evidence: string[][] = [
    [
      `${used} 週把行動完整投入，${full} 週完成基本交付。`,
      ...(used >= cfg.precisionUsedWeeks && full >= cfg.precisionDeliveryWeeks
        ? ["多週同時有效利用行動及完成交付。"]
        : []),
    ],
    [
      `八週共有 ${farming} 次播種或照料，${extra} 週超額交付。`,
      ...(farming >= cfg.growthActions && extra > 0
        ? ["生產投入與超額成果同時出現。"]
        : []),
    ],
    [
      `${stable} 週交足基本糧且留有至少 ${cfg.stabilityStock} 箱緩衝。`,
      ...(stable >= cfg.stableWeeks && farming >= cfg.stableFarmActions
        ? ["維持交付緩衝，同時保留農務投入。"]
        : []),
    ],
    [
      `${adapted} 個事件週投入農務並交足基本糧。`,
      ...(adapted >= cfg.adaptedWeeks && fulfilled > 0
        ? [`完成 ${fulfilled} 筆臨時訂單，顯示取捨後仍有履約能力。`]
        : []),
    ],
    [
      `${safeSkips} 週在交付後庫存安全、有可成長農田及剩餘行動時未再投入。`,
      ...(safeSkips >= cfg.conservativeWeeks
        ? ["此模式多次出現；判斷依當時可見機會，並非單看期末庫存或拒單。"]
        : []),
    ],
  ];
  const eligible = evidence
    .map((e, i) => ({
      i,
      points: [
        (used + full) * cfg.precisionWeight,
        (farming + extra) * cfg.growthWeight,
        stable * cfg.stabilityWeight,
        adapted * cfg.adaptationWeight + fulfilled,
        safeSkips * cfg.conservativeWeight,
      ][i],
      evidence: e,
    }))
    .filter((v) => v.evidence.length >= cfg.minEvidence)
    .sort((a, b) => b.points - a.points || a.i - b.i);
  const enough =
    c.reports.filter((r) => Array.isArray(r.decisions)).length >=
      cfg.minWeeks &&
    decisions.length >= cfg.minActions &&
    eligible.length > 0;
  const main = enough ? eligible[0] : undefined,
    sub = enough ? eligible[1] : undefined;
  return {
    main: main ? archetypes[main.i] : null,
    secondary: sub ? archetypes[sub.i] : null,
    evidence: main?.evidence ?? [
      "判定證據不足：需至少六週、八次有效行動與兩項相互支持的行為證據。",
      "高庫存、拒單或操作次數多，都不單獨代表某種風格。",
    ],
    indicators: {
      stability: Math.round((full / C.weeks) * 100),
      growth: Math.round(Math.min(1, farming / (C.weeks * 2)) * 100),
      adaptation: adapted,
    },
    advice: main
      ? archetypes[main.i].advice
      : "增加不同情境下的決策觀察，再討論團隊偏好的經營方式。",
  };
}
