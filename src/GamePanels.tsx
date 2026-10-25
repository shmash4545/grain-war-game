import { useEffect, useState } from "react";
import { gameConfig as C } from "./gameConfig";
import {
  type City,
  type Game,
  eventFor,
  orderFor,
  monthTotal,
  canCare,
  score,
} from "./gameEngine";
import type { Command, RoomView } from "./protocol";
import { Scene } from "./Scene";
import { ResultCard } from "./ResultCard";
export function WeekHeader({
  week,
  phase,
  paused,
}: {
  week: number;
  phase: Game["phase"];
  paused: boolean;
}) {
  return (
    <>
      <div className="game-heading">
        <div>
          <div className="eyebrow">
            {phase === "final" ? "八週復盤" : "八週經營 · 一城遠見"}
          </div>
          <h1 className="page-title">
            {phase === "lobby"
              ? "萬事俱備，待君啟程。"
              : phase === "final"
                ? "八週耕耘，盛世初成。"
                : `第 ${week} 週 · ${phase === "reveal" ? "本週揭曉" : paused ? "暫停中" : "經營時刻"}`}
          </h1>
        </div>
        <span className="badge">第 {Math.ceil(week / 4)} 月 / 共八週</span>
      </div>
      {phase !== "lobby" && phase !== "final" && (
        <div className="week-strip">
          {Array.from({ length: C.weeks }, (_, i) => (
            <span
              key={i}
              className={
                i + 1 === week ? "current" : i + 1 < week ? "past" : ""
              }
            >
              {i + 1}
              <small>週</small>
            </span>
          ))}
        </div>
      )}
      {paused && (
        <div className="pause-banner" role="status">
          遊戲已暫停，關主恢復後才能繼續操作。
        </div>
      )}
    </>
  );
}
export function CityBoard({
  city,
  week,
  disabled,
  send,
  identity,
}: {
  city: City;
  week: number;
  disabled: boolean;
  send: (cmd: Command) => void;
  identity: string;
}) {
  const [boxes, setBoxes] = useState(C.weeklyDelivery),
    [orderBoxes, setOrderBoxes] = useState(0);
  const event = eventFor(week),
    order = orderFor(week),
    month = Math.floor((week - 1) / C.weeksPerMonth);
  const locked = disabled || city.submitted,
    pendingEvent = !!event?.choice && !city.eventChoice;
  useEffect(() => {
    setBoxes(C.weeklyDelivery);
    setOrderBoxes(0);
  }, [week, identity]);
  return (
    <>
      <div className={`event weather-${event?.weather ?? "sun"}`}>
        <span>本週告示</span>
        <strong>{event?.title ?? "風調雨順"}</strong>
        {event?.description ?? "本週無特殊事件，正是耕耘與規劃的好時機。"}
      </div>
      {event?.choice && (
        <div className="event-choice panel">
          <h3>先決定本週的取捨</h3>
          <p>此選擇發生在收成後、行動前，不回溯改動收成。</p>
          {city.eventChoice ? (
            <strong>
              {city.eventChoice === "accept"
                ? "已派人協助：+3 箱、−1 行動"
                : "已維持原計畫"}
            </strong>
          ) : (
            <div className="buttons">
              <button
                disabled={locked}
                onClick={() => send({ type: "event", choice: "accept" })}
              >
                派人協助 · +3 箱 / −1 行動
              </button>
              <button
                disabled={locked}
                onClick={() => send({ type: "event", choice: "decline" })}
              >
                維持原計畫
              </button>
            </div>
          )}
        </div>
      )}
      <div className="dashboard">
        <section>
          <div className="stats">
            <div>
              糧倉庫存
              <strong key={city.stock}>
                {city.stock}
                <small> 箱</small>
              </strong>
            </div>
            <div>
              剩餘行動
              <strong key={city.remaining}>
                {city.remaining}
                <small> 次</small>
              </strong>
            </div>
            <div>
              本週收成
              <strong>
                {city.harvest}
                <small> 箱</small>
              </strong>
            </div>
          </div>
          <div className="panel farm">
            <div className="section-top">
              <h2>{city.name} · 城郊農田</h2>
              <span>播種 → 跨週照料 → 次週收成 {C.harvestBoxes} 箱</span>
            </div>
            <Scene city={city} week={week} />
            {city.harvest > 0 && (
              <div className="harvest-note" key={week}>
                ✦ 本週已有 {city.harvest} 箱新糧入倉
              </div>
            )}
            <div className="fields">
              {city.fields.map((f, i) => (
                <div key={`${i}-${f.state}`} className={`field ${f.state}`}>
                  <span className="sprouts">
                    {f.state === "empty"
                      ? "▱ ▱ ▱"
                      : f.state === "tilled"
                        ? "⌁ ⌁ ⌁"
                        : "♧ ♧ ♧"}
                  </span>
                  <h3>{String.fromCharCode(65 + i)} 田</h3>
                  <p>
                    {f.state === "empty"
                      ? "空地 · 等待播種"
                      : f.state === "tilled"
                        ? canCare(f, week)
                          ? "已播種 · 可以照料"
                          : `第 ${(f.plantedWeek ?? week) + C.careDelayWeeks} 週可照料`
                        : `第 ${f.readyWeek} 週收成`}
                  </p>
                  {f.state !== "ready" && (
                    <button
                      disabled={
                        locked ||
                        pendingEvent ||
                        city.remaining === 0 ||
                        (f.state === "tilled" && !canCare(f, week))
                      }
                      onClick={() =>
                        send({
                          type: "action",
                          kind: f.state === "empty" ? "till" : "care",
                          field: i,
                        })
                      }
                    >
                      {f.state === "empty" ? "播種" : "照料"} · 1 行動
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="panel logs">
            <h3>本週行動紀錄</h3>
            {city.logs.length ? (
              city.logs.map((l, i) => (
                <span key={i}>
                  {i + 1}. {l}
                </span>
              ))
            ) : (
              <p>尚未採取行動，先想想這週的安排。</p>
            )}
          </div>
        </section>
        <aside>
          <section className="panel">
            <div className="eyebrow">本月糧務</div>
            <h2>
              {monthTotal(city, month)}{" "}
              <small>/ {C.monthlyTargets[month]} 箱</small>
            </h2>
            <progress
              value={monthTotal(city, month)}
              max={C.monthlyTargets[month]}
            />
            <p>
              尚欠{" "}
              {Math.max(0, C.monthlyTargets[month] - monthTotal(city, month))}{" "}
              箱 · 含本週剩 {4 - ((week - 1) % 4)} 週
            </p>
          </section>
          <section className="panel">
            <h3>市集採買</h3>
            <p>
              立即 +{event?.purchaseBoxes ?? C.purchaseBoxes} 箱，消耗一次行動。
            </p>
            <button
              disabled={
                locked ||
                pendingEvent ||
                city.remaining === 0 ||
                city.purchases >= C.purchaseLimit
              }
              onClick={() => send({ type: "action", kind: "buy" })}
            >
              採買糧食 · {city.purchases}/{C.purchaseLimit}
            </button>
          </section>
          {order && (
            <section className="panel order-panel">
              <div className="eyebrow">臨時訂單 · 本週到期</div>
              <h3>
                {order.title} / {order.boxes} 箱
              </h3>
              <p>
                與月目標分帳。全額履約 +{order.reward} 韌性分，接單未交足 −
                {order.penalty} 分；拒單不扣分。韌性總分仍為 0～15。
              </p>
              {!city.orderChoice ? (
                <div className="buttons">
                  <button
                    disabled={locked}
                    onClick={() => send({ type: "order", choice: "accept" })}
                  >
                    接單
                  </button>
                  <button
                    disabled={locked}
                    onClick={() => send({ type: "order", choice: "decline" })}
                  >
                    婉拒
                  </button>
                </div>
              ) : (
                <strong>
                  {city.orderChoice === "accept"
                    ? "已接單，請在下方填入訂單交付量"
                    : "已婉拒，不扣分"}
                </strong>
              )}
            </section>
          )}
          <section className="panel delivery">
            <h3>本週交付</h3>
            <p>基本應交 {C.weeklyDelivery} 箱，可提前超額交付。</p>
            {city.submitted ? (
              <>
                <strong>已鎖定正常交付 {city.delivery} 箱</strong>
                <p>訂單交付 {city.orderDelivery ?? 0} 箱。等候關主揭曉。</p>
              </>
            ) : (
              <>
                <label>
                  正常交付箱數
                  <input
                    type="number"
                    min={0}
                    max={city.stock}
                    step={1}
                    value={boxes}
                    disabled={locked}
                    onChange={(e) => setBoxes(Number(e.target.value))}
                  />
                </label>
                {order && city.orderChoice === "accept" && (
                  <label>
                    訂單交付箱數（不計月目標）
                    <input
                      type="number"
                      min={0}
                      max={order.boxes}
                      step={1}
                      value={orderBoxes}
                      disabled={locked}
                      onChange={(e) => setOrderBoxes(Number(e.target.value))}
                    />
                  </label>
                )}
                <p>
                  預計剩餘 {city.stock - boxes - orderBoxes} 箱 · 基本缺交{" "}
                  {Math.max(0, C.weeklyDelivery - boxes)} 箱
                </p>
                <button
                  className="primary"
                  disabled={
                    locked ||
                    pendingEvent ||
                    (!!order && !city.orderChoice) ||
                    !Number.isInteger(boxes) ||
                    !Number.isInteger(orderBoxes) ||
                    boxes < 0 ||
                    orderBoxes < 0 ||
                    boxes + orderBoxes > city.stock ||
                    orderBoxes > (order?.boxes ?? 0)
                  }
                  onClick={() => {
                    if (
                      confirm(
                        `正常交付 ${boxes} 箱、訂單 ${orderBoxes} 箱？剩餘 ${city.remaining} 次行動將放棄，提交後鎖定。`,
                      )
                    )
                      send({ type: "submit", boxes, orderBoxes });
                  }}
                >
                  確認並鎖定交付
                </button>
              </>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
export function HostControls({
  phase,
  paused,
  allSubmitted,
  allJoined,
  disabled,
  canReopen,
  send,
}: {
  phase: Game["phase"];
  paused: boolean;
  allSubmitted: boolean;
  allJoined: boolean;
  disabled: boolean;
  canReopen: boolean;
  send: (cmd: Command) => void;
}) {
  const confirmed = (type: Command["type"], msg: string) => {
    if (confirm(msg)) send({ type } as Command);
  };
  return (
    <div className="host-bar">
      <strong>關主控場</strong>
      <div className="buttons">
        {phase === "lobby" && (
          <button
            className="primary"
            disabled={disabled || !allJoined}
            onClick={() => confirmed("start", "所有城市就位，開始第一週？")}
          >
            開始第一週 →
          </button>
        )}
        {phase === "actions" && (
          <>
            <button
              disabled={disabled}
              onClick={() =>
                confirmed(
                  paused ? "resume" : "pause",
                  paused ? "恢復遊戲？" : "暫停所有城市操作？",
                )
              }
            >
              {paused ? "恢復遊戲" : "暫停遊戲"}
            </button>
            <button
              disabled={disabled || !canReopen}
              onClick={() =>
                confirmed(
                  "reopen",
                  "重開會清除所有城市本週操作及提交，還原週初庫存與農田並保持暫停。已公開歷史不受影響。確定？",
                )
              }
            >
              重開當週
            </button>
            <button
              className="primary"
              disabled={disabled || paused || !allSubmitted}
              onClick={() =>
                confirmed(
                  "reveal",
                  "公開所有城市的本週結果？公開後不能重開此週。",
                )
              }
            >
              公開本週結果 →
            </button>
          </>
        )}
        {phase === "reveal" && (
          <button
            className="primary"
            disabled={disabled}
            onClick={() => confirmed("advance", "確認完成本週檢討並推進？")}
          >
            下一週／最終結算 →
          </button>
        )}
      </div>
    </div>
  );
}
export function StatusCards({ statuses }: { statuses: RoomView["statuses"] }) {
  return (
    <div className="city-cards">
      {statuses.map((s, i) => (
        <article key={i}>
          <span className="seal">{String.fromCharCode(65 + i)}</span>
          <h3>{s.name}</h3>
          <p>
            {s.joined
              ? s.online
                ? "● 連線中"
                : "○ 暫離／等待連線"
              : "等待加入"}
          </p>
          <strong>{s.submitted ? "已提交 ✓" : "尚未提交"}</strong>
        </article>
      ))}
    </div>
  );
}
export function Published({
  cities,
  week,
  final = false,
}: {
  cities: City[];
  week: number;
  final?: boolean;
}) {
  const [history, setHistory] = useState(week);
  useEffect(() => setHistory(week), [week]);
  const last = week;
  const month = Math.floor((history - 1) / 4);
  return (
    <section className="published">
      <div className="section-top">
        <h2>{final ? "城市總排名與城主鑑定" : "已公開週報"}</h2>
        <span>測試版規則 · 配分尚待校準</span>
      </div>
      {!final && (
        <label className="history-select">
          重播已公開週別
          <select
            value={history}
            onChange={(e) => setHistory(Number(e.target.value))}
          >
            {Array.from({ length: last }, (_, i) => (
              <option key={i} value={i + 1}>
                第 {i + 1} 週{i % 4 === 3 ? " · 月結" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <section className="panel">
        <h3>
          {final
            ? "八週總結"
            : `第 ${history} 週${history % 4 === 0 ? " · 月底小結" : ""}`}
        </h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>城市</th>
                {final ? (
                  <>
                    <th>月目標 /35</th>
                    <th>超額 /25</th>
                    <th>儲備產能 /25</th>
                    <th>韌性 /15</th>
                    <th>總分</th>
                  </>
                ) : (
                  <>
                    <th>收成</th>
                    <th>正常交付</th>
                    <th>訂單交付</th>
                    <th>缺交</th>
                    <th>庫存</th>
                    <th>本月／目標</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {[...cities]
                .sort((a, b) => (final ? score(b).total - score(a).total : 0))
                .map((city, i) => {
                  const r = city.reports.find((r) => r.week === history);
                  return (
                    <tr key={i}>
                      <th>
                        {final ? `${i + 1}. ` : ""}
                        {city.name}
                      </th>
                      {final ? (
                        (
                          [
                            "delivery",
                            "growth",
                            "reserve",
                            "resilience",
                            "total",
                          ] as const
                        ).map((k) => (
                          <td key={k}>{score(city)[k].toFixed(1)}</td>
                        ))
                      ) : (
                        <>
                          <td>{r?.harvest ?? 0}</td>
                          <td>{r?.delivered ?? 0}</td>
                          <td>{r?.order?.delivered ?? 0}</td>
                          <td>{r?.shortage ?? 0}</td>
                          <td>{r?.stock ?? 0}</td>
                          <td>
                            {monthTotal(
                              {
                                ...city,
                                reports: city.reports.filter(
                                  (r) => r.week <= history,
                                ),
                              },
                              month,
                            )}{" "}
                            / {C.monthlyTargets[month]}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
      {final && (
        <>
          <div className="panel">
            <h3>八週正常交付趨勢</h3>
            <p>每個數字代表實際交付箱數，訂單不計入此圖。</p>
            {cities.map((c, i) => (
              <div className="trend-row" key={i}>
                <strong>{c.name}</strong>
                {c.reports.map((r) => (
                  <div
                    key={r.week}
                    title={`第 ${r.week} 週交付 ${r.delivered} 箱`}
                  >
                    <span
                      style={{ height: `${Math.min(70, r.delivered * 4)}px` }}
                    />
                    <b>{r.delivered}</b>
                    <small>W{r.week}</small>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {cities.map((c, i) => (
            <ResultCard key={i} city={c} />
          ))}
        </>
      )}
      <section className="panel">
        <h3>{final ? "完整策略軌跡" : "本週決策重播"}</h3>
        {cities.map((c, i) => (
          <details key={i}>
            <summary>{c.name}</summary>
            {c.reports
              .filter((r) => final || r.week === history)
              .map((r) => (
                <p key={r.week}>
                  第 {r.week} 週｜{r.logs.join("、") || "未使用行動"}｜交付{" "}
                  {r.delivered}、缺交 {r.shortage}、庫存 {r.stock}
                  {r.order
                    ? `｜訂單${r.order.accepted ? ` ${r.order.delivered}/${r.order.required} 箱，${r.order.points} 分` : "婉拒，不扣分"}`
                    : ""}
                </p>
              ))}
          </details>
        ))}
      </section>
      <div className="notice">
        本場城市團隊的策略紀錄，並非個人人格或績效評量。人物僅為象徵性風格聯想，非史實人格測驗。
      </div>
    </section>
  );
}
