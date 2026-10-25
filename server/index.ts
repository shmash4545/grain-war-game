import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { RoomStore } from "./store";
import { createApp } from "./app";
const file = resolve(process.env.DATA_FILE ?? ".data/rooms.sqlite");
mkdirSync(dirname(file), { recursive: true });
const origins = (
  process.env.ALLOWED_ORIGINS ??
  "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const store = new RoomStore(file),
  server = createApp(store, origins);
server.listen(Number(process.env.PORT ?? 3001), "0.0.0.0", () =>
  console.log(`Room service listening on port ${process.env.PORT ?? 3001}`),
);
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
