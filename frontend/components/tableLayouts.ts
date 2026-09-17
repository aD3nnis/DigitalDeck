export type SeatKey = "top" | "topLeft" | "topRight" | "left" | "right" | "bottom";

export type HandSlot = "handTop" | "handTL" | "handTR" | "handL" | "handR";

/** Clockwise from you (bottom = index 0). */
export type Layout = {
  folder: string;
  /** seat → board filename inside folder */
  boards: Partial<Record<SeatKey, string>>;
  /** which opponent hand slots to show */
  hands: Partial<Record<HandSlot, Exclude<SeatKey, "bottom">>>;
};

export const RING: Record<number, SeatKey[]> = {
  1: ["bottom"],
  2: ["bottom", "top"],
  3: ["bottom", "left", "right"],
  4: ["bottom", "left", "top", "right"],
  5: ["bottom", "left", "topLeft", "topRight", "right"],
  6: ["bottom", "left", "topLeft", "top", "topRight", "right"],
};

/** Canonical seats for turn-order index 0..n-1 (edit these to match what you want). */
export const ABSOLUTE: Record<number, SeatKey[]> = {
  1: ["bottom"],
  2: ["bottom", "top"],
  3: ["bottom", "left", "right"],          // your 3p preference
  4: ["bottom", "left", "top", "right"],   // P3/P4 swap
  5: ["bottom", "left", "topLeft", "topRight", "right"],
  6: ["bottom", "left", "topLeft", "top", "topRight", "right"],
};

function rotateSeat(seat: SeatKey, viewerAbs: SeatKey, ring: SeatKey[]): SeatKey {
  const i = ring.indexOf(seat);
  const v = ring.indexOf(viewerAbs);
  return ring[(i - v + ring.length) % ring.length]!;
}

/** turnOrderIds = join/turn order (NOT rotated around the viewer). */
export function screenPlayersBySeat(
  turnOrderIds: string[],
  viewerId: string,
): Partial<Record<SeatKey, string>> {
  const n = turnOrderIds.length;
  const absolute = ABSOLUTE[n];
  const ring = RING[n];
  if (!absolute || !ring) return {};

  const viewerIndex = turnOrderIds.indexOf(viewerId);
  if (viewerIndex < 0) return {};

  const viewerAbs = absolute[viewerIndex]!;
  const out: Partial<Record<SeatKey, string>> = {};

  turnOrderIds.forEach((id, i) => {
    const screen = rotateSeat(absolute[i]!, viewerAbs, ring);
    out[screen] = id;
  });

  return out;
}

const folder = (n: number) => `/board-parts/${n === 1 ? "one" : n === 2 ? "two" : n === 3 ? "three" : n === 4 ? "four" : n === 5 ? "five" : "six"}-player`;

export const LAYOUTS: Record<number, Layout> = {
  1: {
    folder: folder(1),
    boards: {
      bottom: "player-1-board-one-player-game.svg",
    },
    hands: {},
  },
  2: {
    folder: folder(2),
    boards: {
      bottom: "player-1-board-two-player-game.svg",
      top: "player-2-board-two-player-game.svg",
    },
    hands: { handTop: "top" },
  },
  3: {
    folder: folder(3),
    boards: {
      bottom: "player-1-board-three-player-game.svg",
      left: "player-2-board-three-player-game.svg",
      right: "player-3-board-three-player-game.svg",
    },
    hands: { handL: "left", handR: "right" },
  },
  4: {
    folder: folder(4),
    boards: {
      bottom: "player-1-board-four-player-game.svg",
      left: "player-2-board-four-player-game.svg",
      top: "player-3-board-four-player-game.svg",
      right: "player-4-board-four-player-game.svg",
    },
    hands: { handTop: "top", handL: "left", handR: "right" },
  },
  5: {
    folder: folder(5),
    boards: {
      bottom: "player-1-board-five-player-game.svg",
      left: "player-2-board-five-player-game.svg",
      topLeft: "player-3-board-five-player-game.svg",
      topRight: "player-4-board-five-player-game.svg",
      right: "player-5-board-five-player-game.svg",
    },
    hands: {
      handTL: "topLeft",
      handTR: "topRight",
      handL: "left",
      handR: "right",
    },
  },
  6: {
    folder: folder(6),
    boards: {
      bottom: "player-1-board-six-player-game.svg",
      left: "player-2-board-six-player-game.svg",
      topLeft: "player-3-board-six-player-game.svg",
      top: "player-4-board-six-player-game.svg",
      topRight: "player-5-board-six-player-game.svg",
      right: "player-6-board-six-player-game.svg",
    },
    hands: {
      handTop: "top",
      handTL: "topLeft",
      handTR: "topRight",
      handL: "left",
      handR: "right",
    },
  },
};