## me
ok 5 player cards looks good, lets move on to 4 cards, note the margin changes for draw discard and dealer need to be added for 4 as well

---
## Cursor
4-player seats are **bottom → left → top → right** (no top-left/top-right). Same hand fans as six for those seats, plus the draw/discard/dealer margins from 5/6.

---

### 1. New `FourPlayerTable.tsx`

```tsx
"use client";

import type { CSSProperties, ReactNode } from "react";
import styles from "./FourPlayerTable.module.css";

const FOLDER = "/board-parts/four-player";
const HAND = "/cards-in-hand-spots";

/** Match your 5/6 test knobs */
const TEST_COUNT = 3;
const STEP = 7;
const DEG = -4;

type Props = {
  /** Clockwise from you: [you, left, top, right] */
  seatPlayerIds: string[];
  roster: Record<string, string>;
  handBot?: ReactNode;
};

const SEAT_FAN = {
  top: {
    dx: -0.5,
    dy: 0,
    rot: 1,
    src: `${HAND}/default/card-back-blue.svg`,
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
} as const;

type SeatKey = keyof typeof SEAT_FAN;

function backStyle(
  i: number,
  count: number,
  fan: (typeof SEAT_FAN)[SeatKey],
): CSSProperties {
  const x = i * fan.dx * STEP;
  const y = i * fan.dy * STEP;
  const angle = i * fan.rot * DEG;
  return {
    transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`,
    zIndex: count - i,
  };
}

function OpponentHand({
  seat,
  count = TEST_COUNT,
  label,
}: {
  seat: SeatKey;
  count?: number;
  label: string;
}) {
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

export default function FourPlayerTable({
  seatPlayerIds,
  roster,
  handBot,
}: Props) {
  const name = (i: number, fallback: string) => {
    const pid = seatPlayerIds[i];
    return pid ? roster[pid] ?? pid : fallback;
  };

  return (
    <div className={styles.table} aria-label="Four player table">
      <div className={styles.handTop}>
        <OpponentHand seat="top" label="top" />
      </div>

      <div className={`${styles.seat} ${styles.top}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-3-board-four-player-game.svg`}
          alt={`${name(2, "top")}'s board`}
          draggable={false}
        />
      </div>

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

      <div className={styles.handML} aria-hidden />
      <div className={styles.handMR} aria-hidden />

      <div className={`${styles.seat} ${styles.dealer}`}>
        <img
          className={styles.dealerImg}
          src="/board-parts/dealer-boards/dealer-board.svg"
          alt="Dealer board"
          draggable={false}
        />
      </div>

      <div className={styles.handL}>
        <OpponentHand seat="left" label="left" />
      </div>

      <div className={`${styles.seat} ${styles.left}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-2-board-four-player-game.svg`}
          alt={`${name(1, "left")}'s board`}
          draggable={false}
        />
      </div>

      <div className={`${styles.seat} ${styles.right}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-4-board-four-player-game.svg`}
          alt={`${name(3, "right")}'s board`}
          draggable={false}
        />
      </div>

      <div className={styles.handR}>
        <OpponentHand seat="right" label="right" />
      </div>

      <div className={`${styles.seat} ${styles.bottom}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-1-board-four-player-game.svg`}
          alt={`${name(0, "you")}'s board`}
          draggable={false}
        />
      </div>

      <div className={styles.handBot}>{handBot}</div>
    </div>
  );
}
```

---

### 2. New `FourPlayerTable.module.css`

Includes the same pile/dealer margins as 5/6:

```css
.table {
  --table-w: min(350px, 96vw);
  width: var(--table-w);
  height: auto;

  display: grid;
  margin: 0 auto;
  grid-template-columns: 40fr 40fr 97fr 97fr 40fr 40fr;
  /* no TL/TR: handTop, top, piles, dealer, sides, bottom, your hand */
  grid-template-rows: 80fr 46fr 79fr 36fr 117fr 96fr 165fr;
  grid-template-areas:
    "handTop handTop handTop handTop handTop handTop"
    ".       .       top     top     .       ."
    ".       .       draw    discard .       ."
    "handML  handML  dealer  dealer  handMR  handMR"
    "handL   left    left    right   right   handR"
    "bottom  bottom  bottom  bottom  bottom  bottom"
    "handBot handBot handBot handBot handBot handBot";
  column-gap: 0;
  row-gap: 0;
  align-items: center;
  justify-items: center;
  background: #002e08;
  padding: 0;
  box-sizing: border-box;
}

.table > * {
  min-width: 0;
  min-height: 0;
}

.seat {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  position: relative;
}

.top {
  grid-area: top;
  width: 100%;
  max-width: 220px;
}

.dealer {
  grid-area: dealer;
  width: 100%;
  max-width: 280px;
  margin-top: 5px; /* same as 5/6 */
}

.left {
  grid-area: left;
  z-index: 1;
  width: 100%;
}

.right {
  grid-area: right;
  z-index: 1;
  width: 100%;
}

.bottom {
  grid-area: bottom;
  width: 93%;
}

.draw {
  grid-area: draw;
  z-index: 2;
  justify-self: end;
  align-self: end;
  width: auto;
  margin-right: 5px; /* same as 5/6 */
}

.discard {
  grid-area: discard;
  z-index: 2;
  justify-self: start;
  align-self: end;
  width: auto;
  margin-left: 5px; /* same as 5/6 */
}

.handTop {
  grid-area: handTop;
  z-index: 3;
  width: 100%;
  height: 100%;
}

.handBot {
  grid-area: handBot;
  z-index: 3;
  width: 100%;
  height: 100%;
}

.handML {
  grid-area: handML;
  z-index: 3;
  width: 100%;
  height: 100%;
}

.handMR {
  grid-area: handMR;
  z-index: 3;
  width: 100%;
  height: 100%;
}

.handL {
  grid-column: 1 / 2;
  grid-row: 5;
  z-index: 3;
  justify-self: start;
  align-self: center;
  width: 100%;
  height: 100%;
}

.handR {
  grid-column: 6 / 7;
  grid-row: 5;
  z-index: 3;
  justify-self: end;
  align-self: center;
  width: 100%;
  height: 100%;
}

.boardImg,
.dealerImg {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.pileImg {
  display: block;
  width: 44px;
  height: auto;
  pointer-events: auto;
  user-select: none;
}

.handTop,
.handL,
.handR,
.handBot {
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: visible;
  position: relative;
}

.opponentFan {
  position: relative;
  width: 40px;
  height: 56px;
}

.opponentFan .handBackImg {
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

.handTop .opponentFan .handBackImg {
  width: 34px;
  margin-left: -17px;
}

.handL .opponentFan,
.handR .opponentFan {
  width: 36px;
  height: 70px;
}
```

---

### 3. Wire in `SessionScreen.tsx`

```tsx
import FourPlayerTable from "./FourPlayerTable";
```

```tsx
{playerCount !== 6 && playerCount !== 5 && playerCount !== 4 && (
  <ul className={styles.playAreaUnorderedList}>{myHandFan}</ul>
)}
{playerCount !== 6 && !isTwoPlayer && playerCount !== 5 && playerCount !== 4 &&
  drawDiscardSection}

{playerCount === 6 ? (
  <SixPlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
) : playerCount === 5 ? (
  <FivePlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
) : playerCount === 4 ? (
  <FourPlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
) : (
  /* existing 1–3 fallback */
  ...
)}
```

---

**Seat → file:** you=`player-1`, left=`player-2`, top=`player-3`, right=`player-4`.  
**Hands:** top uses `default` backs (fan left); left/right use bottom warped backs toward dealer.

If top feels too far from its board, pull `handTop` down by putting it on the same row as `top` (like six’s `handTL`/`top` row). Switch to Agent mode if you want this created in the repo.

---
## me
ok now lets do 3 player game

---
## Cursor
3-player is **bottom → left → right** (no top). Same left/right hand fans + draw/discard/dealer margins.

---

### 1. New `ThreePlayerTable.tsx`

```tsx
"use client";

import type { CSSProperties, ReactNode } from "react";
import styles from "./ThreePlayerTable.module.css";

const FOLDER = "/board-parts/three-player";
const HAND = "/cards-in-hand-spots";

/** Match your 4/5/6 test knobs */
const TEST_COUNT = 3;
const STEP = 7;
const DEG = -4;

type Props = {
  /** Clockwise from you: [you, left, right] */
  seatPlayerIds: string[];
  roster: Record<string, string>;
  handBot?: ReactNode;
};

const SEAT_FAN = {
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
} as const;

type SeatKey = keyof typeof SEAT_FAN;

function backStyle(
  i: number,
  count: number,
  fan: (typeof SEAT_FAN)[SeatKey],
): CSSProperties {
  const x = i * fan.dx * STEP;
  const y = i * fan.dy * STEP;
  const angle = i * fan.rot * DEG;
  return {
    transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`,
    zIndex: count - i,
  };
}

function OpponentHand({
  seat,
  count = TEST_COUNT,
  label,
}: {
  seat: SeatKey;
  count?: number;
  label: string;
}) {
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

export default function ThreePlayerTable({
  seatPlayerIds,
  roster,
  handBot,
}: Props) {
  const name = (i: number, fallback: string) => {
    const pid = seatPlayerIds[i];
    return pid ? roster[pid] ?? pid : fallback;
  };

  return (
    <div className={styles.table} aria-label="Three player table">
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

      <div className={styles.handML} aria-hidden />
      <div className={styles.handMR} aria-hidden />

      <div className={`${styles.seat} ${styles.dealer}`}>
        <img
          className={styles.dealerImg}
          src="/board-parts/dealer-boards/dealer-board.svg"
          alt="Dealer board"
          draggable={false}
        />
      </div>

      <div className={styles.handL}>
        <OpponentHand seat="left" label="left" />
      </div>

      <div className={`${styles.seat} ${styles.left}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-2-board-three-player-game.svg`}
          alt={`${name(1, "left")}'s board`}
          draggable={false}
        />
      </div>

      <div className={`${styles.seat} ${styles.right}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-3-board-three-player-game.svg`}
          alt={`${name(2, "right")}'s board`}
          draggable={false}
        />
      </div>

      <div className={styles.handR}>
        <OpponentHand seat="right" label="right" />
      </div>

      <div className={`${styles.seat} ${styles.bottom}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-1-board-three-player-game.svg`}
          alt={`${name(0, "you")}'s board`}
          draggable={false}
        />
      </div>

      <div className={styles.handBot}>{handBot}</div>
    </div>
  );
}
```

---

### 2. New `ThreePlayerTable.module.css`

```css
.table {
  --table-w: min(350px, 96vw);
  width: var(--table-w);
  height: auto;

  display: grid;
  margin: 0 auto;
  grid-template-columns: 40fr 40fr 97fr 97fr 40fr 40fr;
  /* no top: piles, dealer, sides, bottom, your hand */
  grid-template-rows: 79fr 36fr 117fr 96fr 165fr;
  grid-template-areas:
    ".      .      draw    discard .      ."
    "handML handML dealer dealer handMR handMR"
    "handL  left  left    right   right  handR"
    "bottom bottom bottom  bottom  bottom bottom"
    "handBot handBot handBot handBot handBot handBot";
  column-gap: 0;
  row-gap: 0;
  align-items: center;
  justify-items: center;
  background: #002e08;
  padding: 0;
  box-sizing: border-box;
}

.table > * {
  min-width: 0;
  min-height: 0;
}

.seat {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  position: relative;
}

.dealer {
  grid-area: dealer;
  width: 100%;
  max-width: 280px;
  margin-top: 5px;
}

.left {
  grid-area: left;
  z-index: 1;
  width: 100%;
}

.right {
  grid-area: right;
  z-index: 1;
  width: 100%;
}

.bottom {
  grid-area: bottom;
  width: 93%;
}

.draw {
  grid-area: draw;
  z-index: 2;
  justify-self: end;
  align-self: end;
  width: auto;
  margin-right: 5px;
}

.discard {
  grid-area: discard;
  z-index: 2;
  justify-self: start;
  align-self: end;
  width: auto;
  margin-left: 5px;
}

.handML {
  grid-area: handML;
  z-index: 3;
  width: 100%;
  height: 100%;
}

.handMR {
  grid-area: handMR;
  z-index: 3;
  width: 100%;
  height: 100%;
}

.handBot {
  grid-area: handBot;
  z-index: 3;
  width: 100%;
  height: 100%;
}

.handL {
  grid-column: 1 / 2;
  grid-row: 3;
  z-index: 3;
  justify-self: start;
  align-self: center;
  width: 100%;
  height: 100%;
}

.handR {
  grid-column: 6 / 7;
  grid-row: 3;
  z-index: 3;
  justify-self: end;
  align-self: center;
  width: 100%;
  height: 100%;
}

.boardImg,
.dealerImg {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.pileImg {
  display: block;
  width: 44px;
  height: auto;
  pointer-events: auto;
  user-select: none;
}

.handL,
.handR,
.handBot {
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: visible;
  position: relative;
}

.opponentFan {
  position: relative;
  width: 40px;
  height: 56px;
}

.opponentFan .handBackImg {
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

.handL .opponentFan,
.handR .opponentFan {
  width: 36px;
  height: 70px;
}
```

---

### 3. Wire in `SessionScreen.tsx`

```tsx
import ThreePlayerTable from "./ThreePlayerTable";
```

```tsx
{playerCount !== 6 &&
  playerCount !== 5 &&
  playerCount !== 4 &&
  playerCount !== 3 && (
    <ul className={styles.playAreaUnorderedList}>{myHandFan}</ul>
  )}
{playerCount !== 6 &&
  !isTwoPlayer &&
  playerCount !== 5 &&
  playerCount !== 4 &&
  playerCount !== 3 &&
  drawDiscardSection}

{playerCount === 6 ? (
  <SixPlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
) : playerCount === 5 ? (
  <FivePlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
) : playerCount === 4 ? (
  <FourPlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
) : playerCount === 3 ? (
  <ThreePlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
) : (
  /* 1–2 fallback */
  ...
)}
```

---

**Seats:** you=`player-1`, left=`player-2`, right=`player-3`.  
**Hands:** only left/right backs (+ your `handBot`). No top fan.

If piles feel high with no top board, shrink the first row `fr` or add a little top padding. Next up after this is usually **2-player** (bottom + top only).

---
## me
ok now lets do two player

---
## Cursor
2-player is **bottom → top** only. Opponent hand uses the same top-center fan as 4/6; your hand goes in `handBot`.

---

### 1. New `TwoPlayerTable.tsx`

```tsx
"use client";

import type { CSSProperties, ReactNode } from "react";
import styles from "./TwoPlayerTable.module.css";

const FOLDER = "/board-parts/two-player";
const HAND = "/cards-in-hand-spots";

/** Match your other table test knobs */
const TEST_COUNT = 3;
const STEP = 7;
const DEG = -4;

type Props = {
  /** Clockwise from you: [you, top] */
  seatPlayerIds: string[];
  roster: Record<string, string>;
  handBot?: ReactNode;
};

const SEAT_FAN = {
  top: {
    dx: -0.5,
    dy: 0,
    rot: 1,
    src: `${HAND}/default/card-back-blue.svg`,
  },
} as const;

type SeatKey = keyof typeof SEAT_FAN;

function backStyle(
  i: number,
  count: number,
  fan: (typeof SEAT_FAN)[SeatKey],
): CSSProperties {
  const x = i * fan.dx * STEP;
  const y = i * fan.dy * STEP;
  const angle = i * fan.rot * DEG;
  return {
    transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`,
    zIndex: count - i,
  };
}

function OpponentHand({
  seat,
  count = TEST_COUNT,
  label,
}: {
  seat: SeatKey;
  count?: number;
  label: string;
}) {
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

export default function TwoPlayerTable({
  seatPlayerIds,
  roster,
  handBot,
}: Props) {
  const name = (i: number, fallback: string) => {
    const pid = seatPlayerIds[i];
    return pid ? roster[pid] ?? pid : fallback;
  };

  return (
    <div className={styles.table} aria-label="Two player table">
      <div className={styles.handTop}>
        <OpponentHand seat="top" label="top" />
      </div>

      <div className={`${styles.seat} ${styles.top}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-2-board-two-player-game.svg`}
          alt={`${name(1, "top")}'s board`}
          draggable={false}
        />
      </div>

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

      <div className={`${styles.seat} ${styles.dealer}`}>
        <img
          className={styles.dealerImg}
          src="/board-parts/dealer-boards/dealer-board.svg"
          alt="Dealer board"
          draggable={false}
        />
      </div>

      <div className={`${styles.seat} ${styles.bottom}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-1-board-two-player-game.svg`}
          alt={`${name(0, "you")}'s board`}
          draggable={false}
        />
      </div>

      <div className={styles.handBot}>{handBot}</div>
    </div>
  );
}
```

---

### 2. New `TwoPlayerTable.module.css`

```css
.table {
  --table-w: min(350px, 96vw);
  width: var(--table-w);
  height: auto;

  display: grid;
  margin: 0 auto;
  grid-template-columns: 40fr 40fr 97fr 97fr 40fr 40fr;
  /* only top + you: handTop, top, piles, dealer, bottom, your hand */
  grid-template-rows: 80fr 46fr 40fr 36fr 96fr 165fr;
  grid-template-areas:
    "handTop handTop handTop handTop handTop handTop"
    ".       .       top     top     .       ."
    ".       .       draw    discard .       ."
    ".       .       dealer  dealer  .       ."
    "bottom  bottom  bottom  bottom  bottom  bottom"
    "handBot handBot handBot handBot handBot handBot";
  column-gap: 0;
  row-gap: 0;
  align-items: center;
  justify-items: center;
  background: #002e08;
  padding: 0;
  box-sizing: border-box;
}

.table > * {
  min-width: 0;
  min-height: 0;
}

.seat {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  position: relative;
}

.top {
  grid-area: top;
  width: 100%;
  max-width: 220px;
}

.dealer {
  grid-area: dealer;
  width: 100%;
  max-width: 280px;
  margin-top: 5px;
}

.bottom {
  grid-area: bottom;
  width: 93%;
}

.draw {
  grid-area: draw;
  z-index: 2;
  justify-self: end;
  align-self: end;
  width: auto;
  margin-right: 5px;
}

.discard {
  grid-area: discard;
  z-index: 2;
  justify-self: start;
  align-self: end;
  width: auto;
  margin-left: 5px;
}

.handTop {
  grid-area: handTop;
  z-index: 3;
  width: 100%;
  height: 100%;
}

.handBot {
  grid-area: handBot;
  z-index: 3;
  width: 100%;
  height: 100%;
}

.boardImg,
.dealerImg {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.pileImg {
  display: block;
  width: 44px;
  height: auto;
  pointer-events: auto;
  user-select: none;
}

.handTop,
.handBot {
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: visible;
  position: relative;
}

.opponentFan {
  position: relative;
  width: 40px;
  height: 56px;
}

.opponentFan .handBackImg {
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

.handTop .opponentFan .handBackImg {
  width: 34px;
  margin-left: -17px;
}
```

---

### 3. Wire in `SessionScreen.tsx`

```tsx
import TwoPlayerTable from "./TwoPlayerTable";
```

Replace the table branch so 2p uses the new table (and stop using the old `isTwoPlayer && drawDiscardSection` path for the main view):

```tsx
{playerCount !== 6 &&
  playerCount !== 5 &&
  playerCount !== 4 &&
  playerCount !== 3 &&
  playerCount !== 2 && (
    <ul className={styles.playAreaUnorderedList}>{myHandFan}</ul>
  )}
{playerCount !== 6 &&
  playerCount !== 5 &&
  playerCount !== 4 &&
  playerCount !== 3 &&
  playerCount !== 2 &&
  drawDiscardSection}

{playerCount === 6 ? (
  <SixPlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
) : playerCount === 5 ? (
  <FivePlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
) : playerCount === 4 ? (
  <FourPlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
) : playerCount === 3 ? (
  <ThreePlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
) : playerCount === 2 ? (
  <TwoPlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
) : (
  /* 1-player fallback if you still need it */
  ...
)}
```

You can drop `isTwoPlayer && isMine && drawDiscardSection` inside the old list once 2p always uses `TwoPlayerTable`.

---

**Seats:** you=`player-1`, opponent=`player-2` (top).  
**Hand:** top uses `default/card-back-blue.svg`, fan left toward center; your fan in `handBot`.

After 2p looks good, only **1-player** (just you + piles) is left for table shells — then wiring real `handCounts`.

---
## me
I want 5 player game to have the same height as the 6th player game so i tried fixing it but its not taking the "." as a space. what needs to be changed about it?

---
## Cursor
`.` does **not** reserve height. It’s only an empty cell label. With `height: auto`, `fr` rows also **don’t invent space** — they size from content. An all-`.` row has no items → **height ≈ 0**.

Six’s first row works because it has **`handTop` content**. Five’s `". . . . . ."` has nothing, so that `80fr` collapses.

### What to change

**1. Give both tables the same definite height** (best fix):

```css
/* FivePlayerTable.module.css AND SixPlayerTable.module.css */
.table {
  height: calc(var(--table-w) * 520 / 350); /* pick one ratio; match six */
}
```

Then the shared `grid-template-rows: 80fr 46fr 79fr 36fr 117fr 96fr 165fr` will actually distribute that height, and the empty first row on five will take real space.

**2. Or** keep `height: auto` and use a **fixed** spacer row instead of `fr` + `.`:

```css
grid-template-rows: 80px 46fr 79fr 36fr 117fr 96fr 165fr;
```

(`80px` ≈ six’s `handTop` band; tune to match.)

---

### Second bug: your row spans are still on the old map

You added a blank first row, but overrides still assume the old 6-row layout:

| Class | You have | Should be (with blank row 1) |
|---|---|---|
| `.topLeft` / `.topRight` | `grid-row: 2` | `grid-row: 3` |
| `.handTL` / `.handTR` | `grid-row: 1 / 3` | `grid-row: 2 / 4` |
| `.handL` / `.handR` | `grid-row: 4` | `grid-row: 5` |

Otherwise boards/hands sit on the wrong tracks even after height is fixed.

---

**Bottom line:** don’t rely on `.` for spacing. Set a shared explicit `height` (or a `px` first row), then bump those `grid-row` values by +1.

---
## me
the top hand cards are in the top row which i dont want, i want it to be blank
---
## Cursor
The blank row is fine — **`handTL` / `handTR` are still spanning into it**.

You currently have something like:

```css
.handTL {
  grid-row: 1 / 3; /* starts on row 1 = the blank spacer */
}
```

With this map:

```text
row 1  . . . . . .                          ← blank
row 2  handTL handTL . . handTR handTR
row 3  topLeft … topRight
```

### Fix

Keep the blank first row, and start the hands on **row 2**:

```css
.handTL {
  grid-column: 1 / 2;   /* or 1 / 3 if you want the wider overlap */
  grid-row: 2 / 4;      /* rows 2–3 only — NOT row 1 */
  z-index: 3;
  /* ... */
}

.handTR {
  grid-column: 6 / 7;
  grid-row: 2 / 4;
  z-index: 3;
  /* ... */
}

.topLeft {
  grid-column: 1 / 4;
  grid-row: 3;          /* board row, not 2 */
  /* ... */
}

.topRight {
  grid-column: 4 / 7;
  grid-row: 3;
  /* ... */
}

.handL {
  grid-row: 5;          /* bump if you added the blank row */
}

.handR {
  grid-row: 5;
}
```

Row 1 stays empty (spacer for height). Hands live on row 2 and can still overlap the boards on row 3.

---
## me
i need to do the same thing for the 3 person layout

---
## Cursor
Same idea as five: add **blank spacer rows** at the top, use **`px`** (not `fr` + `.`) so they actually take height, and keep `handL` / `handR` **off** those rows.

3-player is missing six’s top band (`handTop` + `top`), so pad with two blank rows:

### Update `.table` in `ThreePlayerTable.module.css`

```css
.table {
  --table-w: min(350px, 96vw);
  width: var(--table-w);
  height: auto; /* or same calc() as six if you want exact match */

  display: grid;
  margin: 0 auto;
  grid-template-columns: 40fr 40fr 97fr 97fr 40fr 40fr;
  /* blank + blank = six's handTop + top rows */
  grid-template-rows: 80px 46px 79fr 36fr 117fr 96fr 165fr;
  grid-template-areas:
    ".      .      .       .       .      ."
    ".      .      .       .       .      ."
    ".      .      draw    discard .      ."
    "handML handML dealer  dealer  handMR handMR"
    "handL  left  left    right   right  handR"
    "bottom bottom bottom  bottom  bottom bottom"
    "handBot handBot handBot handBot handBot handBot";
  /* ...rest unchanged... */
}
```

### Bump side-hand row overrides

They were on row 3; with two blank rows they must move to **row 5**:

```css
.handL {
  grid-column: 1 / 2;
  grid-row: 5; /* was 3 */
  z-index: 3;
  justify-self: start;
  align-self: center;
  width: 100%;
  height: 100%;
}

.handR {
  grid-column: 6 / 7;
  grid-row: 5; /* was 3 */
  z-index: 3;
  justify-self: end;
  align-self: center;
  width: 100%;
  height: 100%;
}
```

Draw/dealer/bottom keep using `grid-area` names — no change needed.

**Don’t** put `handL`/`handR` on `grid-row: 1` or `1 / …`. Rows 1–2 stay empty; hands stay on the left/right seat row only.

Tune `80px` / `46px` until 3p matches 6p visually (same values five uses for its top spacer help).

---
## me
same for 2 person layout

---
## Cursor
2-player already has **top + `handTop`**. What’s missing vs 6-player is the **left/right seat row**. Add a blank spacer **there** (between dealer and bottom), with `px` so it doesn’t collapse.

### Update `.table` in `TwoPlayerTable.module.css`

```css
.table {
  --table-w: min(350px, 96vw);
  width: var(--table-w);
  height: auto;

  display: grid;
  margin: 0 auto;
  grid-template-columns: 40fr 40fr 97fr 97fr 40fr 40fr;
  /* blank row 5 = six's left/right band */
  grid-template-rows: 80px 46fr 40fr 36fr 117px 96fr 165fr;
  grid-template-areas:
    "handTop handTop handTop handTop handTop handTop"
    ".       .       top     top     .       ."
    ".       .       draw    discard .       ."
    ".       .       dealer  dealer  .       ."
    ".       .       .       .       .       ."
    "bottom  bottom  bottom  bottom  bottom  bottom"
    "handBot handBot handBot handBot handBot handBot";
  column-gap: 0;
  row-gap: 0;
  align-items: center;
  justify-items: center;
  background: #002e08;
  padding: 0;
  box-sizing: border-box;
}
```

### Hands stay put

- **`handTop`** stays on row 1 via `grid-area: handTop` (opponent backs — keep these).
- **`handBot`** stays on the last row.
- Do **not** assign anything to row 5; leave it all `.`.

No `handL`/`handR` overrides on 2p, so nothing else to bump.

Tune `117px` (and `80px` if needed) until height matches 6/3. Same rule as before: blank space = **`px` row**, not `fr` + `.`.

---
## me
ok now we need to create a one player game

--- 
## Cursor
1-player is **only you** (bottom) + piles/dealer + `handBot`. No opponent hands. Blank out the top/side bands so height matches the others.

---

### 1. New `OnePlayerTable.tsx`

```tsx
"use client";

import type { ReactNode } from "react";
import styles from "./OnePlayerTable.module.css";

const FOLDER = "/board-parts/one-player";

type Props = {
  /** Clockwise from you: [you] */
  seatPlayerIds: string[];
  roster: Record<string, string>;
  handBot?: ReactNode;
};

export default function OnePlayerTable({
  seatPlayerIds,
  roster,
  handBot,
}: Props) {
  const name = (i: number, fallback: string) => {
    const pid = seatPlayerIds[i];
    return pid ? roster[pid] ?? pid : fallback;
  };

  return (
    <div className={styles.table} aria-label="One player table">
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

      <div className={`${styles.seat} ${styles.dealer}`}>
        <img
          className={styles.dealerImg}
          src="/board-parts/dealer-boards/dealer-board.svg"
          alt="Dealer board"
          draggable={false}
        />
      </div>

      <div className={`${styles.seat} ${styles.bottom}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-1-board-one-player-game.svg`}
          alt={`${name(0, "you")}'s board`}
          draggable={false}
        />
      </div>

      <div className={styles.handBot}>{handBot}</div>
    </div>
  );
}
```

---

### 2. New `OnePlayerTable.module.css`

Blank rows = six’s `handTop` + `top` + left/right bands (`px` so they don’t collapse):

```css
.table {
  --table-w: min(350px, 96vw);
  width: var(--table-w);
  height: auto;

  display: grid;
  margin: 0 auto;
  grid-template-columns: 40fr 40fr 97fr 97fr 40fr 40fr;
  /* blanks: handTop, top, sides */
  grid-template-rows: 80px 46px 40fr 36fr 117px 96fr 165fr;
  grid-template-areas:
    ".      .      .       .       .      ."
    ".      .      .       .       .      ."
    ".      .      draw    discard .      ."
    ".      .      dealer  dealer  .      ."
    ".      .      .       .       .      ."
    "bottom bottom bottom  bottom  bottom bottom"
    "handBot handBot handBot handBot handBot handBot";
  column-gap: 0;
  row-gap: 0;
  align-items: center;
  justify-items: center;
  background: #002e08;
  padding: 0;
  box-sizing: border-box;
}

.table > * {
  min-width: 0;
  min-height: 0;
}

.seat {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  position: relative;
}

.dealer {
  grid-area: dealer;
  width: 100%;
  max-width: 280px;
  margin-top: 5px;
}

.bottom {
  grid-area: bottom;
  width: 93%;
}

.draw {
  grid-area: draw;
  z-index: 2;
  justify-self: end;
  align-self: end;
  width: auto;
  margin-right: 5px;
}

.discard {
  grid-area: discard;
  z-index: 2;
  justify-self: start;
  align-self: end;
  width: auto;
  margin-left: 5px;
}

.handBot {
  grid-area: handBot;
  z-index: 3;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: visible;
  position: relative;
}

.boardImg,
.dealerImg {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.pileImg {
  display: block;
  width: 44px;
  height: auto;
  pointer-events: auto;
  user-select: none;
}
```

Tune `80px` / `46px` / `117px` to match your 2/6 heights.

---

### 3. Wire in `SessionScreen.tsx`

```tsx
import OnePlayerTable from "./OnePlayerTable";
```

```tsx
{playerCount === 6 ? (
  <SixPlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
) : playerCount === 5 ? (
  <FivePlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
) : playerCount === 4 ? (
  <FourPlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
) : playerCount === 3 ? (
  <ThreePlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
) : playerCount === 2 ? (
  <TwoPlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
) : (
  <OnePlayerTable
    seatPlayerIds={seatPlayerIds}
    roster={roster}
    handBot={myHandFan}
  />
)}
```

Also stop showing the old standalone hand / `drawDiscardSection` when `playerCount === 1` (same exclusions you use for 2–6).

---

**Seat:** only `player-1`. **Hands:** only your face-up `handBot` — no opponent fans. That finishes the 1–6 table shells.

---
## me
now every number of player game looks correct and i put the hieght at 715px and width is 350px so when players join or leave the game is less wonky.

--- 
## Cursor
Nice — fixed **350×715** across 1–6 is the right call. Same box means join/leave only swaps seat art and hand spots, so the table doesn’t jump.

You’ve finished the table-shell + hand-spot UX pass. Sensible next slices when you’re ready:

1. **Real `handCounts`** — replace `TEST_COUNT` so draws/plays update opponent fans  
2. **Generalize play boards** — cards on every seat’s slots (view-only for opponents)  
3. **Shared `GameTable` / `OpponentHand`** — cut the duplicated fan/CSS across the six table files  

Which do you want to tackle next?