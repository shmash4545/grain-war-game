import type { City, Game } from "./gameEngine";
export type Role = { type: "host" } | { type: "city"; index: number };
export type Session = { code: string; token: string; role: Role };
export type RoomView = {
  code: string;
  revision: number;
  role: Role;
  week: number;
  phase: Game["phase"];
  paused: boolean;
  statuses: {
    name: string;
    joined: boolean;
    submitted: boolean;
    online: boolean;
  }[];
  ownCity?: City;
  published: City[] | null;
};
export type Command =
  | { type: "start" | "advance" | "reveal" | "pause" | "resume" | "reopen" }
  | { type: "action"; kind: "buy" | "till" | "care"; field?: number }
  | { type: "submit"; boxes: number; orderBoxes: number }
  | { type: "event" | "order"; choice: "accept" | "decline" };
