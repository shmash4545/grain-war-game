import { DatabaseSync } from "node:sqlite";
import { randomBytes, createHash } from "node:crypto";
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
  type Game,
} from "../src/gameEngine";
import type { Role, RoomView, Command } from "../src/protocol";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("hex");
type Member = { tokenHash: string; leaseHash: string; role: Role };
type Room = {
  code: string;
  revision: number;
  game: Game;
  snapshot?: Game;
  published: Game["cities"] | null;
  members: Member[];
  receipts: Record<string, { payload: string; revision: number }>;
};
export class RoomError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export class RoomStore {
  db: DatabaseSync;
  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY, data TEXT NOT NULL)",
    );
  }
  private read(code: string): Room {
    const row = this.db
      .prepare("SELECT data FROM rooms WHERE code=?")
      .get(code) as { data: string } | undefined;
    if (!row) throw new RoomError("找不到房間", 404);
    return JSON.parse(row.data);
  }
  private write(r: Room) {
    this.db
      .prepare("INSERT OR REPLACE INTO rooms(code,data) VALUES (?,?)")
      .run(r.code, JSON.stringify(r));
  }
  private transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const r = fn();
      this.db.exec("COMMIT");
      return r;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  private member(r: Room, token: string, lease?: string) {
    const m = r.members.find((m) => m.tokenHash === hash(token));
    if (!m) throw new RoomError("無效的房間操作憑證", 401);
    if (lease !== undefined && m.leaseHash !== hash(lease))
      throw new RoomError("操作權已在其他頁面恢復，請重新取得操作權", 409);
    return m;
  }
  create(count: number, names: string[]) {
    const game = createGame(count, names);
    let code: string;
    do {
      code = String((randomBytes(4).readUInt32BE() % 900000) + 100000);
    } while (this.db.prepare("SELECT 1 FROM rooms WHERE code=?").get(code));
    const token = secret(),
      lease = secret();
    const r: Room = {
      code,
      revision: 0,
      game,
      published: null,
      members: [
        {
          tokenHash: hash(token),
          leaseHash: hash(lease),
          role: { type: "host" },
        },
      ],
      receipts: {},
    };
    this.write(r);
    return { code, token, lease, role: { type: "host" } as Role };
  }
  lobby(code: string) {
    const r = this.read(code);
    return {
      code,
      phase: r.game.phase,
      cities: r.game.cities.map((c, i) => ({
        name: c.name,
        joined: r.members.some(
          (m) => m.role.type === "city" && m.role.index === i,
        ),
      })),
    };
  }
  join(code: string, index: number) {
    return this.transaction(() => {
      const r = this.read(code);
      if (r.game.phase !== "lobby")
        throw new RoomError("遊戲已開始，請使用原憑證恢復");
      if (!Number.isInteger(index) || !r.game.cities[index])
        throw new RoomError("無效城市");
      if (
        r.members.some((m) => m.role.type === "city" && m.role.index === index)
      )
        throw new RoomError("城市已有人加入", 409);
      const token = secret(),
        lease = secret(),
        role: Role = { type: "city", index };
      r.members.push({ tokenHash: hash(token), leaseHash: hash(lease), role });
      r.revision++;
      this.write(r);
      return { code, token, lease, role };
    });
  }
  resume(code: string, token: string) {
    return this.transaction(() => {
      const r = this.read(code),
        m = this.member(r, token),
        lease = secret();
      m.leaseHash = hash(lease);
      this.write(r);
      return { lease, role: m.role };
    });
  }
  view(
    code: string,
    token: string,
    lease: string,
    online: (index: number) => boolean = () => false,
  ): RoomView {
    const r = this.read(code),
      m = this.member(r, token, lease);
    return {
      code,
      revision: r.revision,
      role: m.role,
      week: r.game.week,
      phase: r.game.phase,
      paused: !!r.game.paused,
      statuses: r.game.cities.map((c, i) => ({
        name: c.name,
        joined: r.members.some(
          (m) => m.role.type === "city" && m.role.index === i,
        ),
        submitted: c.submitted,
        online: online(i),
      })),
      ownCity: m.role.type === "city" ? r.game.cities[m.role.index] : undefined,
      published: r.game.phase === "final" ? r.game.cities : r.published,
    };
  }
  command(
    code: string,
    token: string,
    lease: string,
    revision: number,
    id: string,
    cmd: Command,
  ) {
    return this.transaction(() => {
      const r = this.read(code),
        m = this.member(r, token, lease);
      if (typeof id !== "string" || !/^[a-zA-Z0-9-]{8,80}$/.test(id))
        throw new RoomError("缺少有效操作識別碼");
      const key = hash(token + id),
        payload = hash(JSON.stringify({ revision, cmd }));
      if (r.receipts[key]) {
        if (r.receipts[key].payload !== payload)
          throw new RoomError("重複識別碼不得更改內容", 409);
        return { revision: r.revision, replayed: true };
      }
      if (revision !== r.revision)
        throw new RoomError("房間已更新，請等待同步後重試", 409);
      if (!cmd || typeof cmd !== "object") throw new RoomError("無效操作");
      const role = m.role;
      if (role.type === "host") {
        switch (cmd.type) {
          case "start":
            if (
              r.members.filter((m) => m.role.type === "city").length !==
              r.game.cities.length
            )
              throw new RoomError("請等待所有城市加入");
            r.game = start(r.game);
            r.snapshot = structuredClone(r.game);
            break;
          case "reveal":
            r.game = reveal(r.game);
            r.published = structuredClone(r.game.cities);
            break;
          case "advance":
            r.game = advance(r.game);
            if (r.game.phase === "actions")
              r.snapshot = structuredClone(r.game);
            break;
          case "pause":
            r.game = setPaused(r.game, true);
            break;
          case "resume":
            r.game = setPaused(r.game, false);
            break;
          case "reopen":
            if (!r.snapshot) throw new RoomError("沒有當週快照");
            r.game = reopen(r.game, r.snapshot);
            break;
          default:
            throw new RoomError("關主不能代替城市操作", 403);
        }
      } else {
        switch (cmd.type) {
          case "action":
            r.game = action(r.game, role.index, cmd.kind, cmd.field);
            break;
          case "event":
            r.game = chooseEvent(r.game, role.index, cmd.choice);
            break;
          case "order":
            r.game = chooseOrder(r.game, role.index, cmd.choice);
            break;
          case "submit":
            r.game = submit(r.game, role.index, cmd.boxes, cmd.orderBoxes);
            break;
          default:
            throw new RoomError("只有關主可控場", 403);
        }
      }
      r.revision++;
      r.receipts[key] = { payload, revision: r.revision };
      this.write(r);
      return { revision: r.revision, replayed: false };
    });
  }
  close() {
    this.db.close();
  }
}
