import type { Session } from "./protocol";
import { useRoom } from "./online";
import {
  WeekHeader,
  CityBoard,
  HostControls,
  StatusCards,
  Published,
} from "./GamePanels";
export function OnlineGame({
  api,
  session,
  leave,
}: {
  api: string;
  session: Session;
  leave: () => void;
}) {
  const room = useRoom(api, session),
    v = room.view,
    host = v?.role.type === "host";
  return (
    <main>
      <div className="room-ribbon">
        <span>
          房間 <strong>{session.code}</strong> ·{" "}
          {session.role.type === "host" ? "關主" : "城市玩家"}
        </span>
        <span
          className={
            room.status === "即時連線" ? "connection good" : "connection"
          }
        >
          {room.status}
        </span>
        <button
          onClick={() => {
            if (confirm("離開房間畫面？憑證仍保留在此瀏覽器，可稍後恢復。"))
              leave();
          }}
        >
          返回首頁
        </button>
      </div>
      {room.error && (
        <div className="error" role="alert">
          {room.error}
        </div>
      )}
      {room.uncertain && (
        <div className="notice">
          上次操作結果尚未確認，其他操作已暫時鎖定。
          <button disabled={room.busy} onClick={room.retry}>
            安全重試上次操作
          </button>
        </div>
      )}
      {room.status === "操作權已轉移" && (
        <button onClick={room.reclaim}>將操作權恢復到此裝置</button>
      )}
      <details className="recovery">
        <summary>保存私人恢復憑證</summary>
        <p>
          此憑證可恢復你的操作權。請私下保存，勿貼到公開聊天室。其他城市只需房間碼。
        </p>
        <label>
          私人憑證
          <input readOnly value={session.token} />
        </label>
        <button
          onClick={() =>
            navigator.clipboard.writeText(session.token).catch(() => {})
          }
        >
          複製私人憑證
        </button>
      </details>
      {!v ? (
        <section className="panel">
          <h2>正在與房間連線…</h2>
          <p>若一直無法連線，請確認伺服器網址、後端狀態與網路。</p>
        </section>
      ) : (
        <>
          <WeekHeader week={v.week} phase={v.phase} paused={v.paused} />
          {(host || v.phase === "lobby") && (
            <>
              <div className="section-top">
                <h2>{host ? "關主控場台" : "等候城市就位"}</h2>
                <span>揭曉前僅顯示加入、連線與提交狀態</span>
              </div>
              <StatusCards statuses={v.statuses} />
            </>
          )}
          {v.phase === "lobby" && (
            <div className="notice">
              請把房間碼 <strong>{v.code}</strong>{" "}
              告訴其他城市，並使用相同的伺服器網址加入。房間碼不具有關主權限，所有城市加入後即可開始。
            </div>
          )}
          {v.ownCity && v.phase === "actions" && (
            <CityBoard
              city={v.ownCity}
              week={v.week}
              identity={String(
                session.role.type === "city" ? session.role.index : 0,
              )}
              disabled={
                room.busy ||
                room.uncertain ||
                v.paused ||
                room.status !== "即時連線"
              }
              send={room.send}
            />
          )}
          {host && (
            <HostControls
              phase={v.phase}
              paused={v.paused}
              allSubmitted={v.statuses.every((s) => s.submitted)}
              allJoined={v.statuses.every((s) => s.joined)}
              disabled={
                room.busy || room.uncertain || room.status !== "即時連線"
              }
              canReopen
              send={room.send}
            />
          )}
          {v.published && (
            <Published
              cities={v.published}
              week={v.published[0]?.reports.at(-1)?.week ?? v.week}
              final={v.phase === "final"}
            />
          )}
          {!host && v.phase === "reveal" && (
            <div className="notice">關主正在帶領回顧，等待推進下一週。</div>
          )}
        </>
      )}
    </main>
  );
}
