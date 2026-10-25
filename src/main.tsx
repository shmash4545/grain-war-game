import { useState } from "react";
import { createRoot } from "react-dom/client";
import { gameConfig as C } from "./gameConfig";
import {
  type Game,
  createGame,
  start,
  action,
  submit,
  reveal,
  advance,
  chooseEvent,
  chooseOrder,
  setPaused,
  reopen,
} from "./gameEngine";
import type { Command, Session } from "./protocol";
import { Scene } from "./Scene";
import { WeekHeader, CityBoard, HostControls, Published } from "./GamePanels";
import { OnlineGame } from "./OnlineGame";
import { apiAddress, initialApi, request } from "./online";
import "./style.css";
import "./v2.css";
const KEY = "grain-war-v1",
  SESSION = "grain-room-session";
type Save = { game: Game; snapshot?: Game };
function load(): Save | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null"),
      saved = raw?.game ? raw : { game: raw };
    const g = saved.game;
    if (
      g?.version !== 1 ||
      !Array.isArray(g.cities) ||
      g.cities.length < 2 ||
      g.cities.length > 6
    )
      return null;
    for (const c of g.cities) {
      if (!Array.isArray(c.fields) || !Array.isArray(c.reports)) return null;
      for (const f of c.fields)
        if (f.state === "tilled" && f.plantedWeek === undefined)
          f.plantedWeek = g.week;
    }
    return saved;
  } catch {
    return null;
  }
}
function oldSession(): { api: string; session: Session } | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION) || "null");
    return s?.session?.token && s?.api ? s : null;
  } catch {
    return null;
  }
}
function App() {
  const [saved, setSaved] = useState<Save | null>(load),
    [page, setPage] = useState("home"),
    [count, setCount] = useState(2),
    [names, setNames] = useState([...C.cityNames]),
    [city, setCity] = useState(0),
    [error, setError] = useState(""),
    [step, setStep] = useState(0),
    [mode, setMode] = useState<"local" | "online">("local"),
    [api, setApi] = useState(initialApi),
    [connection, setConnection] = useState(oldSession),
    [code, setCode] = useState(""),
    [recovery, setRecovery] = useState(""),
    [lobby, setLobby] = useState<{
      code: string;
      cities: { name: string; joined: boolean }[];
    } | null>(null),
    [busy, setBusy] = useState(false);
  const game = saved?.game;
  const nav = (p: string) => {
    setPage(p);
    setError("");
  };
  const persist = (value: Save) => {
    setSaved(value);
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
      setError("");
    } catch {
      setError("無法保存本機資料，請勿關閉此頁。");
    }
  };
  const localCommand = (cmd: Command) => {
    if (!game) return;
    try {
      let g = game,
        snapshot = saved?.snapshot;
      switch (cmd.type) {
        case "start":
          g = start(g);
          snapshot = structuredClone(g);
          break;
        case "action":
          g = action(g, city, cmd.kind, cmd.field);
          break;
        case "submit":
          g = submit(g, city, cmd.boxes, cmd.orderBoxes);
          break;
        case "event":
          g = chooseEvent(g, city, cmd.choice);
          break;
        case "order":
          g = chooseOrder(g, city, cmd.choice);
          break;
        case "reveal":
          g = reveal(g);
          break;
        case "advance":
          g = advance(g);
          if (g.phase === "actions") snapshot = structuredClone(g);
          setCity(0);
          break;
        case "pause":
          g = setPaused(g, true);
          break;
        case "resume":
          g = setPaused(g, false);
          break;
        case "reopen":
          if (!snapshot) throw Error("舊存檔沒有本週快照，下一週起即可重開");
          g = reopen(g, snapshot);
          break;
      }
      persist({ game: g, snapshot });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const connected = (address: string, session: Session) => {
    const c = { api: address, session };
    setConnection(c);
    nav("online");
    try {
      localStorage.setItem(SESSION, JSON.stringify(c));
      localStorage.setItem("grain-api", address);
    } catch {
      setError(
        "此瀏覽器無法保存操作憑證，請展開房間內的私人恢復憑證並自行保存。",
      );
    }
  };
  const network = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(`連線未完成：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const lessons = [
    [
      "八週，一座城的遠見",
      "全程八週，每四週一個月。每城起始 8 箱糧食、三塊完全相同的田。第一月目標 32 箱，第二月 44 箱。",
    ],
    [
      "四次行動，如何選擇？",
      "每週通常四次行動，農務與採買共用。每次採買兩箱，每週最多四次。播種後最早下一週才能照料，再下一週自動收成七箱。",
    ],
    [
      "事件中的取捨",
      "第 3 週雨天只有三次行動；第 5 週可派人助鄰，以一次行動換三箱。第 6 週採買三箱，第 7 週五次行動。事件都在週初收成之後生效。",
    ],
    [
      "交付與臨時訂單",
      "每週基本交六箱，可超額、不足不淘汰。第 4、7 週有本週到期的臨時訂單，先接單或婉拒；訂單與月目標分帳，同一箱不能重複使用。",
    ],
    [
      "提交、揭曉與關主控場",
      "各城提交後鎖定。關主須等全部提交才可揭曉，再手動推進。經營中可暫停，或還原所有城市至本週起點；已公開週別不可重開。多人模式揭曉前看不到別城策略。",
    ],
    [
      "看見團隊的經營風格",
      "八週後提供暫行配分、趨勢、主副風格與可下載圖卡。以本場團隊決策為證據，觀察不足就明示，不是個人人格或績效診斷。",
    ],
  ];
  return (
    <>
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            nav("home");
          }}
        >
          <span className="seal">糧</span>
          <span>
            糧戰 <small>雙城經營戰</small>
          </span>
        </a>
        <nav>
          <button onClick={() => nav("home")}>首頁</button>
          <button onClick={() => nav("rules")}>規則教學</button>
          {game && <button onClick={() => nav("play")}>單機存檔</button>}
          {connection && (
            <button onClick={() => nav("online")}>返回房間</button>
          )}
          <span className="badge">V2 · 共築盛世</span>
        </nav>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError("")}>關閉</button>
        </div>
      )}
      {page === "home" && (
        <main>
          <section className="hero">
            <div>
              <div className="eyebrow">八週經營 · 一城遠見</div>
              <h1>
                一田一策，
                <br />
                養出你的<span>盛世。</span>
              </h1>
              <p>
                山水之間，一座城正等著你的決策。
                <br />
                耕耘、交付、應變，與友城共寫八週的故事。
              </p>
              <div className="buttons">
                <button className="primary" onClick={() => nav("setup")}>
                  開啟新戰局 ↗
                </button>
                <button onClick={() => nav("join")}>加入多人房間 →</button>
              </div>
              <div className="hero-meta">
                2–6 座城市 <b>·</b> 八週策略經營 <b>·</b> 單機與多人模式
              </div>
            </div>
            <div className="hero-art">
              <Scene />
            </div>
          </section>
          <section className="features">
            {[
              [
                "壹",
                "耕耘長遠",
                "播種、照料與收成，讓每次投入在村莊中留下痕跡。",
              ],
              ["貳", "共度風雨", "共通事件與限時訂單，考驗你的判斷與承諾。"],
              [
                "參",
                "留下城誌",
                "以八週決策看見團隊風格，保存專屬的城主圖卡。",
              ],
            ].map((a) => (
              <article key={a[0]}>
                <span>{a[0]}</span>
                <div>
                  <h3>{a[1]}</h3>
                  <p>{a[2]}</p>
                </div>
              </article>
            ))}
          </section>
          <div className="notice">
            單機模式不需伺服器。多人模式需已部署的房間服務；GitHub Pages
            僅提供前端，無法自行承載多人房間。
          </div>
        </main>
      )}
      {page === "rules" && (
        <main className="narrow">
          <div className="eyebrow">
            遊戲指南 / {step + 1} OF {lessons.length}
          </div>
          <h1 className="page-title">從一粒種子，讀懂經營。</h1>
          <section className="panel tutorial">
            <span className="chapter">0{step + 1}</span>
            <h2>{lessons[step][0]}</h2>
            <p>{lessons[step][1]}</p>
            <div className="dots">
              {lessons.map((_, i) => (
                <button
                  key={i}
                  aria-label={`教學第 ${i + 1} 步`}
                  className={step === i ? "selected" : ""}
                  onClick={() => setStep(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="buttons">
              <button disabled={step === 0} onClick={() => setStep(step - 1)}>
                上一步
              </button>
              {step < lessons.length - 1 ? (
                <button className="primary" onClick={() => setStep(step + 1)}>
                  下一步 →
                </button>
              ) : (
                <button className="primary" onClick={() => nav("setup")}>
                  開始建立戰局
                </button>
              )}
            </div>
          </section>
        </main>
      )}
      {page === "setup" && (
        <main className="narrow">
          <div className="eyebrow">關主設定</div>
          <h1 className="page-title">邀幾座城，一同開局。</h1>
          <section className="panel">
            <div className="mode-toggle">
              <button
                className={mode === "local" ? "selected" : ""}
                onClick={() => setMode("local")}
              >
                同機輪流
              </button>
              <button
                className={mode === "online" ? "selected" : ""}
                onClick={() => setMode("online")}
              >
                多人連線
              </button>
            </div>
            <p>
              {mode === "local"
                ? "所有城市共用本裝置，資料保存於瀏覽器。"
                : "每城各用自己的裝置。關主僅能控場，無法代替城市操作或偷看未公開資料。"}
            </p>
            {mode === "online" && (
              <label>
                房間伺服器網址
                <input
                  type="url"
                  value={api}
                  onChange={(e) => setApi(e.target.value)}
                  placeholder="https://你的房間服務網址"
                />
              </label>
            )}
            <h2>參賽城市</h2>
            <div className="counts">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  className={n === count ? "selected" : ""}
                  onClick={() => setCount(n)}
                >
                  {n} 城
                </button>
              ))}
            </div>
            <div className="name-grid">
              {names.slice(0, count).map((name, i) => (
                <label key={i}>
                  {String.fromCharCode(65 + i)} 城名稱
                  <input
                    value={name}
                    maxLength={12}
                    onChange={(e) =>
                      setNames(
                        names.map((v, j) => (j === i ? e.target.value : v)),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <div className="notice">
              固定教學事件與訂單 · 測試版配分
              <br />
              起始八箱／三田／通常每週四次行動／基本交付六箱
            </div>
            <button
              disabled={busy}
              className="primary"
              onClick={() => {
                if (mode === "local") {
                  if (game && !confirm("建立新局會取代單機存檔，確定？"))
                    return;
                  persist({ game: createGame(count, names) });
                  setCity(0);
                  nav("play");
                } else
                  network(async () => {
                    const address = apiAddress(api),
                      result = await request(address, "", {
                        body: { count, names },
                      });
                    connected(address, result);
                  });
              }}
            >
              建立戰局 →
            </button>
          </section>
        </main>
      )}
      {page === "join" && (
        <main className="narrow">
          <div className="eyebrow">多人房間</div>
          <h1 className="page-title">帶著你的城，赴一場約。</h1>
          <section className="panel">
            <label>
              房間伺服器網址
              <input
                type="url"
                value={api}
                onChange={(e) => {
                  setApi(e.target.value);
                  setLobby(null);
                }}
              />
            </label>
            <label>
              六位房間碼
              <input
                value={code}
                maxLength={6}
                inputMode="numeric"
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ""));
                  setLobby(null);
                }}
              />
            </label>
            <div className="buttons">
              <button
                disabled={busy || code.length !== 6}
                onClick={() =>
                  network(async () => {
                    setLobby(await request(apiAddress(api), `/${code}/lobby`));
                  })
                }
              >
                查看可加入城市
              </button>
            </div>
            {lobby && (
              <div className="city-cards">
                {lobby.cities.map((c, i) => (
                  <article key={i}>
                    <h3>{c.name}</h3>
                    <button
                      disabled={busy || c.joined}
                      onClick={() =>
                        network(async () => {
                          const address = apiAddress(api),
                            result = await request(
                              address,
                              `/${lobby.code}/join`,
                              { body: { index: i } },
                            );
                          connected(address, result);
                        })
                      }
                    >
                      {c.joined ? "已有人加入" : "以此城加入"}
                    </button>
                  </article>
                ))}
              </div>
            )}
            <details>
              <summary>用私人憑證恢復操作權</summary>
              <p>
                恢復會中止此憑證在其他頁面的操作權。不可用房間碼代替私人憑證。
              </p>
              <label>
                私人恢復憑證
                <input
                  type="password"
                  value={recovery}
                  onChange={(e) => setRecovery(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                disabled={busy || code.length !== 6 || recovery.length !== 64}
                onClick={() =>
                  network(async () => {
                    const address = apiAddress(api),
                      data = await request(address, `/${code}/resume`, {
                        body: {},
                        token: recovery,
                      });
                    connected(address, {
                      code,
                      token: recovery,
                      role: data.role,
                    });
                    setRecovery("");
                  })
                }
              >
                恢復我的操作權
              </button>
            </details>
          </section>
        </main>
      )}
      {page === "online" && connection && (
        <OnlineGame
          api={connection.api}
          session={connection.session}
          leave={() => nav("home")}
        />
      )}
      {page === "play" && game && (
        <main>
          <div className="room-ribbon">
            <span>單機輪流 · 本機存檔</span>
            <span>城市資料不具私密隔離</span>
          </div>
          <WeekHeader
            week={game.week}
            phase={game.phase}
            paused={!!game.paused}
          />
          {game.phase === "lobby" && (
            <section className="panel">
              <h2>城市已就位</h2>
              <div className="city-cards">
                {game.cities.map((c, i) => (
                  <article key={i}>
                    <span className="seal">{String.fromCharCode(65 + i)}</span>
                    <h3>{c.name}</h3>
                    <p>八箱糧食 · 三塊田 · 準備就緒</p>
                  </article>
                ))}
              </div>
            </section>
          )}
          {game.phase === "actions" && (
            <>
              <div className="city-tabs">
                {game.cities.map((c, i) => (
                  <button
                    key={i}
                    className={city === i ? "selected" : ""}
                    onClick={() => setCity(i)}
                  >
                    {c.name}{" "}
                    <small>{c.submitted ? "已提交 ✓" : "經營中"}</small>
                  </button>
                ))}
              </div>
              <CityBoard
                city={game.cities[city]}
                week={game.week}
                identity={String(city)}
                disabled={!!game.paused}
                send={localCommand}
              />
            </>
          )}
          <HostControls
            phase={game.phase}
            paused={!!game.paused}
            allSubmitted={game.cities.every((c) => c.submitted)}
            allJoined
            disabled={false}
            canReopen={!!saved?.snapshot}
            send={localCommand}
          />
          {(game.phase === "reveal" || game.phase === "final") && (
            <Published
              cities={game.cities}
              week={game.week}
              final={game.phase === "final"}
            />
          )}
        </main>
      )}
      <footer>
        <span>糧戰：雙城經營戰</span>
        <span>耕耘有時，經營有道。 ✦ V2</span>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
