## me
so what the labels show me is the way players get added to the rotation is not how i want it and i will go step by step to explain what i want changed. 2 player game is how it should be. 3 player game is not. The 3rd player gets added to the right when i want it to be added to the left so those players need to change seats in a sense. The board looks how it should, the players and cards need to be swapped

---
## Cursor
You’re seeing a **seat-mapping** issue, not a board-art issue.

### What 3-player does today

`seatPlayerIds` is `[you, next, next…]`. In `GameTable`, that list is applied with:

```72:73:frontend/components/GameTable.tsx
          : n === 3
            ? ["bottom", "left", "right"]
```

So for 3 players:

| Index | Who | Seat | Hand |
|------|-----|------|------|
| 0 | you | bottom | your fan |
| 1 | next in rotation | **left** | left backs |
| 2 | third | **right** | right backs |

Board SVGs stay as in `tableLayouts.ts`: left still uses `player-2-…`, right still uses `player-3-…`. Those files are not what assigns names/cards — `order` is.

So the next player always lands **left**, and the third **right**. If what you want is the opposite for people/cards, left and right need to swap in that `order` only.

### Change (players + cards only, boards stay)

In `GameTable.tsx`, for 3 players use:

```tsx
: n === 3
  ? ["bottom", "right", "left"]
```

That remaps:

| Index | Who | Seat |
|------|-----|------|
| 0 | you | bottom |
| 1 | next in rotation | **right** |
| 2 | third | **left** |

`countForSeat` / `name` / labels already follow `order`, and hands use the same seat keys (`handL: "left"`, `handR: "right"`), so **names and card backs move with the swap**. You do **not** change `LAYOUTS[3].boards` if the board art already looks right.

### Why 2-player “feels” correct

2-player only has `["bottom", "top"]` — no left/right choice — so this bug can’t show up there.

---

If after that swap you still want the **label** `(3)` on the right while the third person sits left (or the reverse), say so — that would be a separate labeling choice from seat assignment.

Also confirm: is this **only** for 3-player, or should 4–6 also put the next player on your **right** instead of left?

---
## me
i noticed that this order here:   const order: SeatKey[] =
    n === 6
      ? ["bottom", "topLeft", "right", "top", "topRight", "left"]
      : n === 5
        ? ["bottom", "topLeft", "topRight", "right", "left"]
        : n === 4
          ? ["bottom", "top", "right", "left"]
          : n === 3
            ? ["bottom", "right", "left"]
            : n === 2
              ? ["bottom", "top"]
              : ["bottom"];

is correct for player 1 but not correct for but not correct for any other player. this is making me thing each player needs its own SeatKey. I can try to find a pattern that doesnt have duplicate code if you can think of one but i cannot currently think of one which makes me think i need 6 seatKeys

---
## Cursor
You don’t need six different `SeatKey` systems. One screen-relative `SeatKey` set is enough — the bug is that your `order` arrays aren’t a real walk around the table.

### What already rotates per player

`seatsClockwiseFromMe` already builds a **viewer-relative** list:

```text
seatPlayerIds = [you, next, next, …]
```

`order[i]` then means “put `seatPlayerIds[i]` in this **on-screen** seat.”  
Index `0` is always `bottom` (you). That model is correct for every player **if** `order` is one consistent loop.

### Why it only looks right for player 1

These are not loops around the table:

```ts
// 4: jumps bottom → top (skips sides)
["bottom", "top", "right", "left"]

// 6: jumps bottom → topLeft → right → …
["bottom", "topLeft", "right", "top", "topRight", "left"]
```

They were tuned so **player 1’s** names/cards match the art. When player 2 becomes index `0`, the same scrambled list is reused, so neighbors no longer sit next to the people they should. That’s a broken rotation, not missing seat types.

### The pattern (one `order` per table size)

Pick **one** direction and stick to it. For “next player on my right” (what you want for 3):

```ts
const order: SeatKey[] =
  n === 6
    ? ["bottom", "right", "topRight", "top", "topLeft", "left"]
    : n === 5
      ? ["bottom", "right", "topRight", "topLeft", "left"]
      : n === 4
        ? ["bottom", "right", "top", "left"]
        : n === 3
          ? ["bottom", "right", "left"]
          : n === 2
            ? ["bottom", "top"]
            : ["bottom"];
```

That’s the same ring, just truncated for fewer seats. For “next on my left”, mirror it (`bottom → left → … → right`).

With that, the same `order` works for every viewer:

| You are | `seatPlayerIds` | Screen |
|--------|-----------------|--------|
| P1 | `[P1,P2,P3,…]` | P1 bottom, P2 right, … |
| P2 | `[P2,P3,P4,…]` | P2 bottom, P3 right, … |

No per-player `SeatKey` copy.

### What you might be mixing up

| Concept | What it is |
|--------|------------|
| `SeatKey` | Where on **your** screen (`bottom`, `left`, …) |
| `seatPlayerIds` | Who sits relative to **you** |
| Board SVG `player-2-board…` | Art drawn for a fixed layout (usually “canonical P1 at bottom”) |

Board file names do **not** need to rotate with who you are. Names + hand counts follow `order` + `seatPlayerIds`. If painted “Player 2” on the SVG bothers you later, that’s a separate art/label issue — not a reason for six seat maps.

### When you *would* need absolute seats

Only if you must keep a fixed world layout (e.g. “host always owns the physical left board in the room”). Then:

1. Assign each `playerId` an absolute seat once  
2. Rotate that map so the viewer’s seat becomes `bottom`

That’s still one `SeatKey` enum — just absolute→screen rotation. Functionally the same as cyclic `order` + rotated `seatPlayerIds`.

**Bottom line:** keep one `SeatKey` set; make each `order` a pure ring (`bottom → right → … → left` or the mirror). Don’t hand-permute for player 1 — that’s what breaks everyone else.

---
## me
actually here is the problem, on a 4 person setup player 3 and 4 need to swap, so its not clockwise at that point. and thats because the top seat is inbetween left and right. Thats why it gets messed up

--- 
## Cursor
You’ve named the real constraint: for 4 players your **wanted layout is not a walk around the table**.

### What you want (player‑1 / host view)

Clockwise would be:

```text
bottom → left → top → right
  P1       P2    P3     P4
```

You’re saying P3 and P4 should swap:

```text
bottom → left → right → top
  P1       P2     P3     P4
```

So next can still be on the left, but the **third** person goes to **right**, and the **fourth** to **top** — because on screen `top` sits between `left` and `right`, and your art/UX wants that pairing, not “around the table.”

That’s fine as a **fixed layout**. It is **not** a ring. So this pattern breaks:

```ts
seatPlayerIds = [you, next, next, …]
order = [bottom, left, top, right]  // one list for everyone
```

That only stays consistent for every viewer when `order` is a real circle. Your 4p map isn’t, so after rotation P3/P4 look wrong for everyone who isn’t player 1.

### What to do instead (still one `SeatKey` set)

1. **Pin absolute seats once** (the layout you want from the “canonical” view).
2. **Rotate those seats** so the current viewer’s seat becomes `bottom`.

```ts
// 4p ring used only to rotate the camera — not turn order
const RING_4: SeatKey[] = ["bottom", "left", "top", "right"];

// Your intentional (non-clockwise) assignment: index = join/turn order
const ABSOLUTE_4: SeatKey[] = ["bottom", "left", "right", "top"];
//                                 P1       P2      P3      P4

function rotateSeat(seat: SeatKey, from: SeatKey, ring: SeatKey[]): SeatKey {
  const i = ring.indexOf(seat);
  const f = ring.indexOf(from);
  return ring[(i - f + ring.length) % ring.length]!; // from → bottom
}

function screenSeatFor(
  playerIndex: number, // 0..3 in roster/turn order
  viewerIndex: number,
): SeatKey {
  const absolute = ABSOLUTE_4[playerIndex]!;
  const viewerAbs = ABSOLUTE_4[viewerIndex]!;
  return rotateSeat(absolute, viewerAbs, RING_4);
}
```

Example: viewer is P2 (absolute `left`):

| Player | Absolute | On P2’s screen |
|--------|----------|----------------|
| P2 | left | **bottom** |
| P3 | right | top |
| P4 | top | right |
| P1 | bottom | left |

P3/P4 stay “swapped” relative to clockwise in the **world** layout; each person still sees themselves at the bottom.

### How this differs from what you have now

| Approach | 4p P3/P4 swap | Correct for all viewers |
|----------|---------------|-------------------------|
| `seatPlayerIds` + one cyclic `order` | No (forces a ring) | Yes |
| `seatPlayerIds` + your non-cyclic `order` | Yes for P1 only | No |
| Absolute seats + rotate viewer to `bottom` | Yes | Yes |

You do **not** need six different `SeatKey` enums. You need:

- `ABSOLUTE_n` — “where each turn-index sits” (4p can be special-cased)
- `RING_n` — geometric neighbors for camera rotation only

Same idea for 3/5/6: if those layouts **are** pure rings, `ABSOLUTE_n` can equal the ring prefix and it collapses to what you have now. **Only 4p** needs the weird `["bottom","left","right","top"]` absolute map.

If that absolute map is what you want (`P2 left, P3 right, P4 top`), say so and we can sketch the same thing for 3/5/6 next to it so one helper covers all counts.

--- 
## me
this will most likely be the case for 5 and 6 player games as well because topLeft is inbetween left and top and topright is inbetween top and right so they jump out of the "circle" order as well

--- 
## Cursor
Yes — same class of problem. Whenever the seats you care about aren’t only “neighbors around the rim,” a single `seatPlayerIds` + cyclic `order` list will lie for someone.

### Important nuance for 5 / 6

On **your board art**, 5 and 6 are already drawn as a rim walk:

```text
6p art:  bottom → left → topLeft → top → topRight → right
           1        2       3       4       5         6

5p art:  bottom → left → topLeft → topRight → right
           1        2       3         4         5
```

So if absolute seats **follow that art order**, 5/6 **are** a circle and the simple model works.  
Diagonals only “jump out of the circle” if you assign people in a **different** order (like the 4p P3/P4 swap) — e.g. fill outer sides first, then tuck diagonals in because they sit *between* on screen.

### One model for every player count

Don’t special-case “circle vs not” in two systems. Always:

1. **`ABSOLUTE[n]`** — turn-index → seat in the canonical (host / art) layout  
2. **`RING[n]`** — seats in geometric order (for rotating the camera only)  
3. Rotate so the viewer’s absolute seat becomes `bottom`

```ts
const RING: Record<number, SeatKey[]> = {
  2: ["bottom", "top"],
  3: ["bottom", "left", "right"],           // or left/right as you prefer
  4: ["bottom", "left", "top", "right"],
  5: ["bottom", "left", "topLeft", "topRight", "right"],
  6: ["bottom", "left", "topLeft", "top", "topRight", "right"],
};

// Canonical “who sits where” — edit these to match what you want on screen for P1
const ABSOLUTE: Record<number, SeatKey[]> = {
  2: ["bottom", "top"],
  3: ["bottom", "right", "left"],             // your 3p preference
  4: ["bottom", "left", "right", "top"],      // P3/P4 swapped vs rim
  // If 5/6 should match art / rim, ABSOLUTE === RING:
  5: ["bottom", "left", "topLeft", "topRight", "right"],
  6: ["bottom", "left", "topLeft", "top", "topRight", "right"],
  // If instead you fill “betweens” like 4p, ABSOLUTE diverges, e.g. 6p:
  // 6: ["bottom", "left", "right", "topLeft", "topRight", "top"],
};
```

Viewer mapping stays the same for every `n`:

```ts
function screenSeat(absSeat: SeatKey, viewerAbs: SeatKey, ring: SeatKey[]): SeatKey {
  const i = ring.indexOf(absSeat);
  const v = ring.indexOf(viewerAbs);
  return ring[(i - v + ring.length) % ring.length]!;
}
```

- **`RING`** = how the table turns when “I sit here.”  
- **`ABSOLUTE`** = where P1…Pn sit in the default view (can break the rim whenever art/UX needs it).

### How to decide 5 / 6

For each count, sit as player 1 and write who should be at each seat. That list **is** `ABSOLUTE[n]`.

- If it matches the rim → same as today’s cyclic `order`, and other players stay correct.  
- If you find yourself swapping people because of “between” seats → keep that weird `ABSOLUTE` and still use `RING` only to rotate — don’t encode the swap inside `seatPlayerIds` order.

So you still don’t need six `SeatKey` types — you need **per-count absolute maps**, and 4 (and maybe 5/6) are allowed to be non-circular on purpose.

---
## me
so what code changes do i need to make to do this?

---
## Cursor
Here’s a concrete change plan that fits your current files.

### 1. Add seating helpers in `tableLayouts.ts`

Put `RING`, `ABSOLUTE`, and the rotate helper next to `LAYOUTS` (or a small `seating.ts` if you prefer).

```ts
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
  3: ["bottom", "right", "left"],          // your 3p preference
  4: ["bottom", "left", "right", "top"],   // P3/P4 swap
  5: ["bottom", "left", "topLeft", "topRight", "right"], // start = art; tweak later
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
```

Tune only `ABSOLUTE[3]`, `ABSOLUTE[4]`, etc. until player‑1’s view looks right. Don’t touch `RING` unless the physical neighbor order of seats is wrong.

---

### 2. Change `SessionScreen.tsx` — stop rotating in the parent

Replace `seatsClockwiseFromMe(...)` with **fixed turn order**:

```ts
// BEFORE
const seatPlayerIds = seatsClockwiseFromMe(roster, playerId);

// AFTER
const turnOrderIds = Object.keys(roster); // same order as join / turn list
```

Pass that into `GameTable` (rename the prop for clarity):

```tsx
<GameTable
  playerCount={turnOrderIds.length}
  turnOrderIds={turnOrderIds}
  viewerId={playerId}
  roster={roster}
  // ...unchanged
/>
```

You can delete `seatsClockwiseFromMe` and the unused `orderedSeats` block once nothing else uses them.

---

### 3. Change `GameTable.tsx` — map by screen seat, not by `order.indexOf`

**Props**

```ts
type Props = {
  playerCount: number;
  turnOrderIds: string[];  // was seatPlayerIds
  viewerId: string;        // new
  roster: Record<string, string>;
  // ...
};
```

**Replace the big `order` ternary** with:

```ts
import { LAYOUTS, screenPlayersBySeat, ABSOLUTE, type SeatKey } from "./tableLayouts";

const bySeat = screenPlayersBySeat(turnOrderIds, viewerId);

const pidAt = (seat: SeatKey) => bySeat[seat];

const countForSeat = (seat: SeatKey) => {
  const pid = pidAt(seat);
  return pid ? handCounts?.[pid] ?? 0 : 0;
};

const name = (seat: SeatKey, fallback: string) => {
  const pid = pidAt(seat);
  return pid ? roster[pid] ?? pid : fallback;
};

const seatNumber = (seat: SeatKey) => {
  const pid = pidAt(seat);
  if (!pid) return 0;
  // stable number = position in turn order (1..n), not screen position
  return turnOrderIds.indexOf(pid) + 1;
};
```

In `board()`:

```ts
<span className={styles.playerLabel}>
  {name(seat, seat)} ({seatNumber(seat)})
</span>
```

Hands already use seat keys (`handL: "left"`, etc.), so `countForSeat(seat!)` keeps working with no layout CSS changes.

---

### 4. What you do **not** need to change

- `LAYOUTS` board/hand file maps  
- `*PlayerTable.module.css` seat positions  
- `OpponentHand` (still gets a screen `SeatKey`)

---

### 5. How to verify

1. As **player 1**, confirm names/cards match your intended `ABSOLUTE[n]`.  
2. As **player 2+**, confirm you are always at bottom and relative neighbors still match that same absolute layout (rotated).  
3. If 5/6 look wrong only for P1, edit `ABSOLUTE[5]` / `ABSOLUTE[6]` only — not `RING`.

---

**Summary:** add `RING` + `ABSOLUTE` + `screenPlayersBySeat`; pass unrotated `Object.keys(roster)` + `viewerId`; remove viewer-relative `order` / `seatsClockwiseFromMe` from `GameTable`.

I'm in Ask mode, so I can’t apply this — switch to Agent mode if you want it wired in for you.

--- 
## me
4 player is incorrect, whats is the assumption it should be with the current setup?

--- 
## Cursor
With the **current** 4-player setup, this is what it assumes.

### Canonical view (player 1 = first in `turnOrderIds`)

`ABSOLUTE[4]` is:

```ts
["bottom", "left", "right", "top"]
```

So as player 1 you should see:

| Turn # | Seat | vs board art (`LAYOUTS[4]`) |
|--------|------|-------------------------------|
| 1 | **bottom** | matches (player-1 art) |
| 2 | **left** | matches (player-2 art) |
| 3 | **right** | art says this is **player 4** |
| 4 | **top** | art says this is **player 3** |

That’s the “P3/P4 swap” we talked about: next is left, but 3 and 4 are **not** around the rim (`left → top → right`). They’re `left → right → top`.

### What `RING[4]` assumes

```ts
["bottom", "left", "top", "right"]  // geometric clockwise
```

That’s only used to **spin the table** so whoever is viewing sits at `bottom`. It does **not** define who sits where — `ABSOLUTE` does.

So for player 2 (absolute seat `left`), after rotation the screen should be:

| Who | Absolute | On P2’s screen |
|-----|----------|----------------|
| P2 | left | bottom |
| P3 | right | top |
| P4 | top | right |
| P1 | bottom | left |

### If that looks “wrong”

Two common mismatches:

1. **You want art order** (labels 1–4 match board files) → use rim order:
   ```ts
   4: ["bottom", "left", "top", "right"]
   ```
2. **You want next on the right** (like your 3p) with P3/P4 swapped the other way → e.g.:
   ```ts
   4: ["bottom", "right", "left", "top"]
   ```

**Current assumption in one line:** as P1, P2 is left, P3 is right, P4 is top — not clockwise, and not matching the player-3/4 board art.

--- 
## me
its not working so when its like this currently on absolute: 5: ["bottom", "left", "topLeft", "topRight", "right"],
left is player 3 in seat 2, topLeft is player 4 in seat 3, topRight is player 5 in seat 4 and right is player 2 in seat 5

--- 
## Cursor

What you’re seeing means **pure ring `ABSOLUTE` is fine** — **`turnOrderIds` order is wrong**.

### What pure ring assumes (you as player 1)

With:

```ts
ABSOLUTE[5] = ["bottom", "left", "topLeft", "topRight", "right"]
```

and **you = `turnOrderIds[0]`**, you should see:

| Screen seat | Player # (label) | Board art |
|-------------|------------------|-----------|
| bottom | **1** | player-1 |
| left | **2** | player-2 |
| topLeft | **3** | player-3 |
| topRight | **4** | player-4 |
| right | **5** | player-5 |

### What you’re actually seeing

| Screen seat | Label | Board art |
|-------------|-------|-----------|
| left | **(3)** | player-**2** |
| topLeft | **(4)** | player-**3** |
| topRight | **(5)** | player-**4** |
| right | **(2)** | player-**5** |

Board art is still the fixed layout. Labels follow **`turnOrderIds` index + 1**, not the SVG number.

So **`turnOrderIds[2]` is at left** where **`turnOrderIds[1]` should be** — everyone is shifted because the id list doesn’t match join/turn order.

### Likely cause

In `SessionScreen`:

```ts
const turnOrderIds = Object.keys(roster);
```

`Object.keys(roster)` is **not guaranteed** to be join order (updates/rebuilds can reorder keys). `ABSOLUTE[i]` assumes index `i` = player `i+1` in **real** turn order.

### Fix

Use the **server’s player order** (you already have `playerOrder` in Redis on the backend), not `Object.keys(roster)`.

Conceptually:

```ts
// turnOrderIds from backend, e.g. session.playerOrder
const turnOrderIds = playerOrder; // ["p1-id", "p2-id", "p3-id", "p4-id", "p5-id"]
```

Then keep:

```ts
ABSOLUTE[5] = ["bottom", "left", "topLeft", "topRight", "right"]
```

### Quick check

Log as player 1:

```ts
console.log("turnOrderIds", turnOrderIds);
console.log("viewerId", playerId);
console.log("bySeat", screenPlayersBySeat(turnOrderIds, playerId));
```

If `turnOrderIds[1]` isn’t player 2’s id, **`ABSOLUTE` tweaks won’t fix it** — fix the order source first.

After `turnOrderIds` matches join order, pure ring should work for 5p without extra rotations. If you still want a deliberate shift after that, we can adjust `ABSOLUTE[5]` from the correct baseline.

---
## me
im going to ask you to make these changes for testing
---
## Cursor
`playerOrder` is wired end-to-end for testing.

**Backend**
- `ROSTER` payload is now `{ players, playerOrder }` in `SessionSocketController` and `DisconnectGraceService`
- `GAME_STATE` includes `playerOrder`
- `DECK_INITIALIZED` includes `playerOrder`

**Frontend**
- `page.tsx` stores `playerOrder` and updates it from those events
- `SessionScreen` takes `playerOrder` and uses it for `turnOrderIds` (falls back to `Object.keys(roster)`)

Restart the Spring backend so the Java changes load, then rejoin a session to pick up the new payloads.

---
## me
that order is correct for every screen, how is it different then what you were asking me to do previously?
--- 
## Cursor
They’re solving **different layers** of the same pipeline.

### What `playerOrder` fixed

That’s only: **who is player 1, 2, 3…** — the same list the server uses for turns.

Before, the UI used `Object.keys(roster)`, which can disagree with Redis `playerOrder`. So seats looked wrong even when the **geometry** math was fine.

### What I asked you to do earlier

That’s the **seat map**:

1. `ABSOLUTE` — where those numbered players sit in the default layout  
2. `RING` — how the table spins so *you* are at bottom  

`screenPlayersBySeat(turnOrderIds, viewerId)` still does that.

### How they fit together

```text
playerOrder  →  [idA, idB, idC, …]     // who is #1, #2, #3
ABSOLUTE     →  seat for each index    // where #1, #2, #3 sit
RING+rotate  →  same layout, you at bottom
```

`playerOrder` did **not** replace ABSOLUTE/RING. It gave that system the **correct input list**.

### Why every screen can look right now

If order is correct for every viewer, that means:

- Server order matches how you think of P1–Pn, **and**
- `ABSOLUTE` + rotation is placing them the way you want

Earlier, when things only looked right for “player 1,” it was often a mix of wrong `turnOrderIds` **and** non-ring ABSOLUTE experiments — not that every client needed its own `SeatKey` set.

**Short version:** previously = *where* seats go; this change = *who* fills those seats, from the server. You needed both; you just landed the missing “who.”

--- 
## me
is there any other changes that need to be made since this was technically testing? or is the code you added not testing and should be apart of the commit

--- 
## Cursor
**Keep it — it’s real feature code, not a throwaway test harness.**  
“For testing” only meant you wanted it in so you could verify seating; the design (server order → UI seats) is what you want long-term.

### Should be in the commit
- Backend: `playerOrder` on `ROSTER`, `GAME_STATE`, `DECK_INITIALIZED`
- Frontend: `playerOrder` state, event handling, prop into `SessionScreen` → `turnOrderIds`
- Seating helpers (`ABSOLUTE` / `RING` / `screenPlayersBySeat`) if those are already in your working tree and look right

### Optional cleanup (not required to keep the feature)
- `event.payload.players ?? event.payload` — keep while you care about old backends; can drop the `?? event.payload` later
- `playerOrder.length > 0 ? playerOrder : Object.keys(roster)` — fine as a safety net
- Dead code in `SessionScreen` (`seatsClockwiseFromMe`, unused `orderedSeats`) — tidy when you like
- Comments like `// P3/P4 swap` / unused `ABSOLUTE` import in `GameTable` — cosmetic

### No need to revert
Don’t strip `playerOrder` after testing. Without it you’re back to guessing order from `Object.keys(roster)`.

So: commit this as the seating/order fix (plus any ABSOLUTE tweaks you settled on). Cleanups can be the same commit or a follow-up.