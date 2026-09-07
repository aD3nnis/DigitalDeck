## me
that is correct, so I want to make sure i have the UX for this layour figured out and the functionality as well, what should we work on first?

---
## Cursor
Start with the **table shell and seat mapping**, not slot placement on every board yet.

You already have player-1 placement working. The next gap is **showing the right boards in the right fixed spots** when player count changes. Until that’s solid, polishing click/place on side boards won’t matter much.

### Work in this order

**1. Table layout + seat map (UX first, no new game rules)**  
Build one `GameTable` (or similar) that:
- reads player count → picks folder (`two-player/`, `three-player/`, …)
- rotates roster so **you are always seat 1 / bottom**
- maps seats 2–6 clockwise to the correct SVG files
- renders draw/discard in the center for every count

Use empty boards only at first. Goal: 2p–6p should match your screenshots before worrying about cards on every seat.

**2. Generalize `Plyr1PlayBoard` → `PlayBoard`**  
One component that takes:
- `boardSvg` path
- `seatKey` for warped card art (`plyr-bottom-center`, `plyr-top-center`, etc.)
- `occupied`, `interactive` (true only for your seat)

Player 1 keeps today’s behavior; opponent boards are view-only with warped images on slots.

**3. Wire opponent boards to `playAreas`**  
You already store `{ b04: "AH", … }` per player. Render those on each seat’s board from WebSocket/API state. No new backend work unless something’s missing.

**4. Lock interaction rules per seat**  
Decide and implement:
- **Your board:** select hand → select slot → double-click to place (what you have)
- **Your played cards:** select slot/card → discard (what you have)
- **Opponent boards:** view only for v1 (no placing on their board)

**5. Polish overlap / click priority**  
Once multiple boards are on screen, verify SVG paint order so overlapping slots hit the topmost shape. Same mechanism as player 1.

**6. Pickup-to-hand (later slice)**  
Select played card on your board → double-click → return to hand. Needs a new API endpoint.

### UX to decide now (quick, saves rework)

1. **Opponent cards:** always visible on their slots, or hidden until played? (Your screenshots imply visible.)
2. **Selecting empty slot:** toggle vs single-select only? (You mentioned double-click flakiness with toggle.)
3. **Draw/discard:** same center position for all player counts, or nudge per layout?

### What not to do first

- Don’t hand-code 21 separate React boards.
- Don’t add pickup/animations before the table layout works for 2–6.
- Don’t change backend play storage again — slot maps are already the right model.

If you want a single concrete first task: **“Render the 6-player table with all 6 board SVGs + center draw/discard, no cards yet, you always on bottom.”** That validates layout and seat rotation; slot interaction can follow seat-by-seat starting with player 1 (already done) then top-center, then sides.

Switch to Agent mode when you’re ready to implement step 1.

---
## me
give me the code for this task in ask mode: Render the 6-player table with all 6 board SVGs + center draw/discard, no cards yet, you always on bottom.

--- 
## Cursor

Here’s a **shell-only** 6-player table: empty board SVGs + center draw/discard, you always bottom. No slots, no cards, no clicks yet.

### 1. New file `frontend/components/SixPlayerTable.tsx`

```tsx
"use client";

import styles from "./SixPlayerTable.module.css";

const FOLDER = "/board-parts/six-player";

/** Seat index 0 = you (bottom). Clockwise after that. */
const SEATS = [
  {
    seat: 1,
    area: "bottom",
    src: `${FOLDER}/player-1-board-six-player-game.svg`,
    label: "you",
  },
  {
    seat: 2,
    area: "left",
    src: `${FOLDER}/player-2-board-six-player-game.svg`,
    label: "left",
  },
  {
    seat: 3,
    area: "topLeft",
    src: `${FOLDER}/player-3-board-six-player-game.svg`,
    label: "top-left",
  },
  {
    seat: 4,
    area: "top",
    src: `${FOLDER}/player-4-board-six-player-game.svg`,
    label: "top",
  },
  {
    seat: 5,
    area: "topRight",
    src: `${FOLDER}/player-5-board-six-player-game.svg`,
    label: "top-right",
  },
  {
    seat: 6,
    area: "right",
    src: `${FOLDER}/player-6-board-six-player-game.svg`,
    label: "right",
  },
] as const;

type Props = {
  /** Clockwise from you: [you, next, …] — length 6 for this shell */
  seatPlayerIds: string[];
  roster: Record<string, string>;
};

export default function SixPlayerTable({ seatPlayerIds, roster }: Props) {
  return (
    <div className={styles.table} aria-label="Six player table">
      {SEATS.map(({ seat, area, src, label }, i) => {
        const pid = seatPlayerIds[i];
        const name = pid ? roster[pid] ?? pid : label;
        return (
          <div
            key={seat}
            className={`${styles.seat} ${styles[area]}`}
            data-seat={seat}
          >
            <img
              className={styles.boardImg}
              src={src}
              alt={`${name}'s board`}
              draggable={false}
            />
          </div>
        );
      })}

      <div className={styles.center}>
        <img
          className={styles.pileImg}
          src="/board-parts/dealer-boards/draw-pile-board.svg"
          alt="Draw pile"
          draggable={false}
        />
        <img
          className={styles.pileImg}
          src="/board-parts/dealer-boards/discard-pile-board.svg"
          alt="Discard pile"
          draggable={false}
        />
      </div>
    </div>
  );
}
```

### 2. New file `frontend/components/SixPlayerTable.module.css`

Tune widths until it matches your screenshot; structure is the important part.

```css
.table {
  --table-w: min(920px, 96vw);
  position: relative;
  width: var(--table-w);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr;
  grid-template-rows: auto auto auto auto;
  grid-template-areas:
    ".        top      ."
    "topLeft  center   topRight"
    "left     center   right"
    ".        bottom   .";
  gap: 0.35rem 0.5rem;
  align-items: center;
  justify-items: center;
  background: #143e1b;
  padding: 0.75rem;
  box-sizing: border-box;
}

.seat {
  display: flex;
  justify-content: center;
  align-items: center;
}

.top {
  grid-area: top;
  width: min(280px, 40%);
}

.topLeft {
  grid-area: topLeft;
  width: min(150px, 70%);
  justify-self: end;
}

.topRight {
  grid-area: topRight;
  width: min(150px, 70%);
  justify-self: start;
}

.left {
  grid-area: left;
  width: min(160px, 75%);
  justify-self: end;
}

.right {
  grid-area: right;
  width: min(160px, 75%);
  justify-self: start;
}

.bottom {
  grid-area: bottom;
  width: min(420px, 92%);
}

.center {
  grid-area: center;
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
  align-self: center;
}

.boardImg,
.pileImg {
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
  user-select: none;
}

.pileImg {
  width: 44px;
}
```

### 3. Seat rotation helper (put near top of `SessionScreen.tsx` or in a small util)

```ts
/** Returns [you, …clockwise others]. Length = roster size. */
function seatsClockwiseFromMe(
  roster: Record<string, string>,
  me: string,
): string[] {
  const seats = Object.keys(roster);
  const myIndex = seats.findIndex((id) => id === me);
  if (myIndex === -1) return seats;
  // you last in current orderedSeats → flip so you are first (bottom)
  const after = seats.slice(myIndex + 1);
  const before = seats.slice(0, myIndex);
  return [me, ...after, ...before];
}
```

Your existing `orderedSeats` puts you **last**. For the table shell you want you **first** (seat 1 / bottom).

### 4. Wire into `SessionScreen` (6-player only for now)

```tsx
import SixPlayerTable from "./SixPlayerTable";

// inside the component:
const seatPlayerIds = seatsClockwiseFromMe(roster, playerId);
const playerCount = Object.keys(roster).length;

// in the return, replace the old play-area list when testing 6p:
{playerCount === 6 ? (
  <SixPlayerTable seatPlayerIds={seatPlayerIds} roster={roster} />
) : (
  /* keep your current play-area UI for 1–5 while you iterate */
  <ul className={styles.playAreaUnorderedList}>{/* … */}</ul>
)}
```

Keep hand / leave / status below the table as they are.

---

### What you should see
- Bottom = your board (`player-1`)
- Clockwise: left, top-left, top, top-right, right
- Draw + discard in the middle
- Empty green slot art from the SVGs (no card images yet)

### Not in this slice
- Slot click / place
- Showing `playAreas`
- Switching folders for 2–5 (same pattern later: `N-player/player-K-...`)

If the spacing looks off vs your Illustrator mock, nudge the `width` / `gap` values in the CSS — don’t change the seat → file mapping.

---
## me
did i implement the code correctly?

--- 
## Cursor
**Mostly yes** for `SixPlayerTable` itself — the seat map, file paths, and CSS are right. The wiring in `SessionScreen` has a few problems.

### What’s good
- `SixPlayerTable.tsx` / `.module.css` match the plan  
- `seatsClockwiseFromMe` is correct (you first = bottom)  
- Import + `playerCount === 6` ternary are in place  

### What’s wrong

**1. You kept the old play-area list *and* added the ternary**

You still have the original block at ~283–332, then the new ternary at ~343. For 6 players you’ll see **both** the old stacked boards and the new table.

Delete the first `<ul className={styles.playAreaUnorderedList}>…</ul>` (lines 283–332). Keep only the ternary.

**2. Hand UI is gone**

There’s no `hand.map` / `handCardUnorderedList` anymore. That got dropped when pasting. Put the hand block back **after** the ternary (before Leave), same as before.

**3. Double draw/discard on 6 players**

You still have:

```tsx
{!isTwoPlayer && drawDiscardSection}
```

On 6p that shows the old center piles **plus** the ones inside `SixPlayerTable`. Gate it:

```tsx
{playerCount !== 6 && !isTwoPlayer && drawDiscardSection}
```

(or only render `drawDiscardSection` in the 1–5 branch).

---

### Target shape of the return (play areas section)

```tsx
{playerCount === 6 ? (
  <SixPlayerTable seatPlayerIds={seatPlayerIds} roster={roster} />
) : (
  <ul className={styles.playAreaUnorderedList}>
    {/* existing 1–5 orderedSeats map only once */}
  </ul>
)}

{gameMode === "TURN_ROTATION" && (/* … */)}

{playerCount !== 6 && !isTwoPlayer && drawDiscardSection}

{/* hand fan back here */}

<button onClick={onLeave}>Leave session</button>
```

After that cleanup, the 6-player shell should be correct.

--- 
## me
is it correct now?

--- 
## Cursor
Yes — this looks correct for the 6-player shell.

- One play-area path: ternary only (no duplicate list)
- Hand fan is back
- Old draw/discard skipped when `playerCount === 6` (piles live in `SixPlayerTable`)
- 1–5 still use the previous UI; 2p still gets draw/discard next to your board

To verify: start a 6-player game and you should see bottom → left → top-left → top → top-right → right with center draw/discard, and your hand under the table.
