## me
let cut duplicates

---
## Cursor
Best cut: **one shared fan + one `GameTable`**, keep the **six CSS grid files** (those are intentionally different). I’m in Ask mode, so here’s copy-paste structure.

### Plan

| Keep | Extract / replace |
|---|---|
| `*PlayerTable.module.css` (grids) | Delete six `*PlayerTable.tsx` |
| — | New `OpponentHand.tsx` + CSS |
| — | New `tableLayouts.ts` (seats + board paths) |
| — | New `GameTable.tsx` |
| `SessionScreen` | One `<GameTable />` call |

---

### 1. `frontend/components/tableLayouts.ts`

```ts
export type SeatKey = "top" | "topLeft" | "topRight" | "left" | "right" | "bottom";

export type HandSlot = "handTop" | "handTL" | "handTR" | "handL" | "handR";

/** Clockwise from you (bottom = index 0). */
export type Layout = {
  folder: string;
  /** seat → board filename inside folder */
  boards: Partial<Record<SeatKey, string>>;
  /** which opponent hand slots to show */
  hands: Partial<Record<HandSlot, SeatKey>>;
};

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
```

---

### 2. `frontend/components/OpponentHand.tsx`

```tsx
"use client";

import type { CSSProperties } from "react";
import styles from "./OpponentHand.module.css";
import type { SeatKey } from "./tableLayouts";

const HAND = "/cards-in-hand-spots";

/** Swap for real handCounts later */
export const TEST_HAND_COUNT = 3;
const STEP = 7;
const DEG = -4;

const SEAT_FAN: Record<
  Exclude<SeatKey, "bottom">,
  { dx: number; dy: number; rot: number; src: string }
> = {
  top: {
    dx: -0.5,
    dy: 0,
    rot: 1,
    src: `${HAND}/default/card-back-blue.svg`,
  },
  topLeft: {
    dx: 0.1,
    dy: -0.5,
    rot: -1,
    src: `${HAND}/plyrs-top-left-right/card-back-blue-left.svg`,
  },
  topRight: {
    dx: -0.1,
    dy: -0.5,
    rot: 1,
    src: `${HAND}/plyrs-top-left-right/card-back-blue-right.svg`,
  },
  left: {
    dx: 0.1,
    dy: -1.1,
    rot: -1,
    src: `${HAND}/plyrs-bottom-left-right/card-back-blue-left.svg`,
  },
  right: {
    dx: -0.1,
    dy: -1.1,
    rot: 1,
    src: `${HAND}/plyrs-bottom-left-right/card-back-blue-right.svg`,
  },
};

function backStyle(
  i: number,
  count: number,
  fan: (typeof SEAT_FAN)[Exclude<SeatKey, "bottom">],
): CSSProperties {
  return {
    transform: `translate(${i * fan.dx * STEP}px, ${i * fan.dy * STEP}px) rotate(${i * fan.rot * DEG}deg)`,
    zIndex: count - i,
  };
}

type Props = {
  seat: Exclude<SeatKey, "bottom">;
  count?: number;
  label: string;
};

export default function OpponentHand({
  seat,
  count = TEST_HAND_COUNT,
  label,
}: Props) {
  const fan = SEAT_FAN[seat];
  return (
    <div className={styles.opponentFan} aria-label={`${label} hand (${count})`}>
      {Array.from({ length: count }, (_, i) => (
        <img
          key={i}
          className={styles.handBackImg}
          src={fan.src}
          alt=""
          draggable={false}
          style={backStyle(i, count, fan)}
        />
      ))}
    </div>
  );
}
```

### 3. `frontend/components/OpponentHand.module.css`

```css
.opponentFan {
  position: relative;
  width: 40px;
  height: 56px;
}

.handBackImg {
  position: absolute;
  left: 50%;
  bottom: 0;
  margin-left: -17px;
  transform-origin: bottom center;
  display: block;
  width: 34px;
  height: auto;
  pointer-events: none;
  user-select: none;
}
```

(Per-slot taller boxes stay in each table CSS as `.handL :global(...)` **or** keep a small local rule — simplest: leave the `.handL .opponentFan { height: 70px }` rules in each table CSS; they’ll still match the class name `opponentFan` on the child.)

CSS modules scope class names, so parent `.handL .opponentFan` **won’t** see `OpponentHand`’s hashed class unless you use `:global`. Easiest fix: pass a `className` into `OpponentHand` **or** put the tall-box rules in `OpponentHand.module.css` with modifiers:

```tsx
// OpponentHand.tsx
<div
  className={`${styles.opponentFan} ${seat === "top" ? styles.upright : styles.warped}`}
>
```

```css
.warped {
  width: 36px;
  height: 70px;
}
```

---

### 4. `frontend/components/GameTable.tsx`

```tsx
"use client";

import type { ReactNode } from "react";
import OpponentHand from "./OpponentHand";
import { LAYOUTS, type SeatKey } from "./tableLayouts";

import styles1 from "./OnePlayerTable.module.css";
import styles2 from "./TwoPlayerTable.module.css";
import styles3 from "./ThreePlayerTable.module.css";
import styles4 from "./FourPlayerTable.module.css";
import styles5 from "./FivePlayerTable.module.css";
import styles6 from "./SixPlayerTable.module.css";

const STYLES = {
  1: styles1,
  2: styles2,
  3: styles3,
  4: styles4,
  5: styles5,
  6: styles6,
} as const;

type Props = {
  playerCount: number;
  seatPlayerIds: string[];
  roster: Record<string, string>;
  handBot?: ReactNode;
};

const HAND_CLASS: Record<string, string> = {
  handTop: "handTop",
  handTL: "handTL",
  handTR: "handTR",
  handL: "handL",
  handR: "handR",
};

const SEAT_CLASS: Record<SeatKey, string> = {
  top: "top",
  topLeft: "topLeft",
  topRight: "topRight",
  left: "left",
  right: "right",
  bottom: "bottom",
};

export default function GameTable({
  playerCount,
  seatPlayerIds,
  roster,
  handBot,
}: Props) {
  const n = Math.min(6, Math.max(1, playerCount)) as 1 | 2 | 3 | 4 | 5 | 6;
  const styles = STYLES[n];
  const layout = LAYOUTS[n];

  const name = (seat: SeatKey, fallback: string) => {
    const order: SeatKey[] =
      n === 6
        ? ["bottom", "left", "topLeft", "top", "topRight", "right"]
        : n === 5
          ? ["bottom", "left", "topLeft", "topRight", "right"]
          : n === 4
            ? ["bottom", "left", "top", "right"]
            : n === 3
              ? ["bottom", "left", "right"]
              : n === 2
                ? ["bottom", "top"]
                : ["bottom"];
    const i = order.indexOf(seat);
    const pid = i >= 0 ? seatPlayerIds[i] : undefined;
    return pid ? roster[pid] ?? pid : fallback;
  };

  const board = (seat: SeatKey) => {
    const file = layout.boards[seat];
    if (!file) return null;
    const cls = SEAT_CLASS[seat];
    return (
      <div key={seat} className={`${styles.seat} ${styles[cls as keyof typeof styles]}`}>
        <img
          className={styles.boardImg}
          src={`${layout.folder}/${file}`}
          alt={`${name(seat, seat)}'s board`}
          draggable={false}
        />
      </div>
    );
  };

  return (
    <div className={styles.table} aria-label={`${n} player table`}>
      {Object.entries(layout.hands).map(([slot, seat]) => (
        <div
          key={slot}
          className={styles[HAND_CLASS[slot] as keyof typeof styles]}
        >
          <OpponentHand seat={seat!} label={seat!} />
        </div>
      ))}

      {board("top")}
      {board("topLeft")}
      {board("topRight")}

      <div className={styles.draw}>
        <img
          className={styles.pileImg}
          src="/board-parts/dealer-boards/draw-pile-board.svg"
          alt="Draw pile"
          draggable={false}
        />
      </div>
      <div className={styles.discard}>
        <img
          className={styles.pileImg}
          src="/board-parts/dealer-boards/discard-pile-board.svg"
          alt="Discard pile"
          draggable={false}
        />
      </div>

      {"handML" in styles && <div className={styles.handML} aria-hidden />}
      {"handMR" in styles && <div className={styles.handMR} aria-hidden />}

      <div className={`${styles.seat} ${styles.dealer}`}>
        <img
          className={styles.dealerImg}
          src="/board-parts/dealer-boards/dealer-board.svg"
          alt="Dealer board"
          draggable={false}
        />
      </div>

      {board("left")}
      {board("right")}
      {board("bottom")}

      <div className={styles.handBot}>{handBot}</div>
    </div>
  );
}
```

Note: render order can matter less with named grid areas; if something stacks wrong, match the DOM order from your current six-player file.

Also put the clockwise `order` arrays into `tableLayouts.ts` next to each layout to avoid the inline ternaries.

---

### 5. `SessionScreen.tsx`

```tsx
import GameTable from "./GameTable";
// remove Six/Five/Four/Three/Two/One imports

// ...

<GameTable
  playerCount={playerCount}
  seatPlayerIds={seatPlayerIds}
  roster={roster}
  handBot={myHandFan}
/>
```

---

### 6. Cleanup

- Delete the six `*PlayerTable.tsx` files  
- Keep the six `*.module.css` files  
- Remove duplicated `.opponentFan` blocks from those CSS files once `OpponentHand.module.css` owns them (keep only layout/grid rules + `.handL` flex centering)

---

### Don’t merge yet

Unifying all grids into one CSS file is a separate pass — easy to break your 715×350 tuning. This cut removes the real duplication (fan math ×5, board JSX ×6, SessionScreen switch).

Switch to **Agent mode** if you want this applied and the old files removed for you.

--- 
## me
is there any duplicate code to get rid of in the modules one-six?

--- 
## Cursor
Yes — but only some of it is safe to delete **right now**.

### Safe to delete (dead duplicates)

Every `*PlayerTable.module.css` that still has these can drop them — fan styling lives in `OpponentHand.module.css`, and parent selectors won’t match across CSS modules anyway:

```css
.opponentFan { ... }
.opponentFan .handBackImg { ... }
.handTop .opponentFan .handBackImg { ... }
.handL .opponentFan,
.handR .opponentFan,
.handTL .opponentFan,
.handTR .opponentFan { ... }
```

Remove that whole block from **2–6** (1-player never had it).

---

### Still duplicated, but still needed per file

These repeat across modules, but each file needs its own copy unless you extract a shared module:

| Rule | Why keep (for now) |
|---|---|
| `.seat`, `.draw`, `.discard`, `.dealer` margins | Used by `GameTable` via that count’s CSS module |
| `.boardImg` / `.pileImg` / `.dealerImg` | Same |
| `.handTop` / `.handL` / … flex centering | Positions the hand **slot**, not the fan art |
| `.table` grid areas/rows | **Must stay different** per player count |

So: delete fan rules; don’t delete grid/layout rules.

---

### Optional next dedupe (later)

Create `GameTableShared.module.css` with seat/pile/image/hand-slot flex, then in each count file:

```css
.seat { composes: seat from "./GameTableShared.module.css"; }
```

or import both class sets in `GameTable`. That’s a second pass — not required for the OpponentHand cut.

**Bottom line:** strip the `.opponentFan*` blocks from modules 2–6; leave the grids alone.