## me
I was able to get my 6 player game boards to look good, is the next logical step to make my 5 player layout look corect and so on?
---
## Cursor
Yes. That’s the right next move.

You’re still on **step 1** from the earlier plan: empty table shells that match your Illustrator layouts, with you always on bottom. Six-player is done; five-player is the natural follow-on, then four, three, two.

Keep the same bar you used for six:

- Empty board SVGs + center draw/discard
- Seat rotation so you stay bottom
- No slots, cards, or clicks yet

Only after 2–6 all look right should you generalize `Plyr1PlayBoard` and wire opponent cards. Polishing interaction on one board while the other counts are still a stacked list will fight you later.

**Practical tip:** After five (and maybe four), if the grid/CSS pattern is repeating, extract a small shared `GameTable` that picks the folder + seat map by count — but don’t refactor prematurely; five alone is enough to validate the pattern.

---
## me
show me the code for the 5 person layout

---
## Cursor
Five-player is your six-player shell **minus the top-center seat**. Same overlap pattern for corners + piles.

Seats (clockwise from you): **bottom → left → top-left → top-right → right**  
Files: `player-1` … `player-5` in `five-player/`.

### `FivePlayerTable.tsx`

```tsx
"use client";

import styles from "./FivePlayerTable.module.css";

const FOLDER = "/board-parts/five-player";

type Props = {
  /** Clockwise from you: [you, left, topLeft, topRight, right] */
  seatPlayerIds: string[];
  roster: Record<string, string>;
};

export default function FivePlayerTable({ seatPlayerIds, roster }: Props) {
  const name = (i: number, fallback: string) => {
    const pid = seatPlayerIds[i];
    return pid ? roster[pid] ?? pid : fallback;
  };

  return (
    <div className={styles.table} aria-label="Five player table">
      <div className={`${styles.seat} ${styles.topLeft}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-3-board-five-player-game.svg`}
          alt={`${name(2, "top-left")}'s board`}
          draggable={false}
        />
      </div>

      <div className={`${styles.seat} ${styles.topRight}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-4-board-five-player-game.svg`}
          alt={`${name(3, "top-right")}'s board`}
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

      <div className={`${styles.seat} ${styles.left}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-2-board-five-player-game.svg`}
          alt={`${name(1, "left")}'s board`}
          draggable={false}
        />
      </div>

      <div className={`${styles.seat} ${styles.right}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-5-board-five-player-game.svg`}
          alt={`${name(4, "right")}'s board`}
          draggable={false}
        />
      </div>

      <div className={`${styles.seat} ${styles.bottom}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-1-board-five-player-game.svg`}
          alt={`${name(0, "you")}'s board`}
          draggable={false}
        />
      </div>
    </div>
  );
}
```

### `FivePlayerTable.module.css`

Start from your six-player grid; **drop the `top` row**. Swap in your five-player AI `fr` / artboard numbers when you measure them.

```css
.table {
  --table-w: min(350px, 96vw);
  /* replace 395/350 with your five-player artboard H/W */
  width: var(--table-w);
  height: calc(var(--table-w) * 395 / 350);

  display: grid;
  margin: 0 auto;
  /* replace with five-player AI column widths as Nfr when you have them */
  grid-template-columns: 40fr 40fr 97fr 97fr 40fr 40fr;
  /* no top-center row — 4 rows */
  grid-template-rows: 79fr 36fr 117fr 96fr;
  grid-template-areas:
    "topLeft  topLeft  draw     discard  topRight topRight"
    ".        .        dealer   dealer   .        ."
    ".        left     left     right    right    ."
    "bottom   bottom   bottom   bottom   bottom   bottom";
  column-gap: 0;
  row-gap: 0;
  align-items: center;
  justify-items: center;
  background: #002e08;
  padding: 0; /* keep 0 if you size boards from --table-w */
  box-sizing: border-box;
}

.seat {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.table > * {
  min-width: 0;
  min-height: 0;
}

.dealer { grid-area: dealer; width: 100%; max-width: 280px; }
.left   { grid-area: left;   width: 100%; }
.right  { grid-area: right;  width: 100%; }
.bottom { grid-area: bottom; width: 93%; }

/* still share cells with draw/discard */
.topLeft {
  grid-column: 1 / 4;
  grid-row: 1;
  z-index: 1;
  width: auto;
  height: 100%;
  max-height: 100%;
  justify-self: start;
  align-self: end;
}

.topRight {
  grid-column: 4 / 7;
  grid-row: 1;
  z-index: 1;
  width: auto;
  height: 100%;
  max-height: 100%;
  justify-self: end;
  align-self: end;
}

.draw {
  grid-area: draw;
  z-index: 2;
  justify-self: end;
  align-self: end;
  width: auto;
}

.discard {
  grid-area: discard;
  z-index: 2;
  justify-self: start;
  align-self: end;
  width: auto;
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

.topLeft .boardImg,
.topRight .boardImg {
  width: calc(var(--table-w) * 135 / 350);
  height: auto;
  max-height: 100%;
  object-fit: contain;
}
```

### Wire in `SessionScreen`

```tsx
{playerCount === 6 ? (
  <SixPlayerTable seatPlayerIds={seatPlayerIds} roster={roster} />
) : playerCount === 5 ? (
  <FivePlayerTable seatPlayerIds={seatPlayerIds} roster={roster} />
) : (
  /* existing 1–4 UI */
)}
```

`seatsClockwiseFromMe` already gives `[you, …clockwise]` — for 5 that maps to bottom / left / topLeft / topRight / right.

### What to replace from Illustrator

| Token | Meaning |
|---|---|
| `395 / 350` | five-player artboard H / W |
| column `40fr 40fr 97…` | five-player column widths |
| row `79fr 36fr…` | five-player row heights (no top strip) |
| `135 / 350` | topLeft / topRight board width on that artboard |

If you paste the five-player artboard W×H and row/column px from AI, those `fr` values can be filled in exactly like six-player.