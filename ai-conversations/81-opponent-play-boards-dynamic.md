## me
Now I want opponents play sots to be dynamic, no longer static like plyr ones play board is

---
## Cursor
Opponent boards are still **static images**; only your bottom board is a live slotted SVG. Making opponents dynamic means the same pattern as `Plyr1PlayBoard`, but **view-only**.

### Current gap

In `GameTable`, you render yourself with `Plyr1PlayBoard` + `myPlayArea`, and everyone else with a plain board `<img>`:

```128:144:frontend/components/GameTable.tsx
  const board = (seat: SeatKey) => {
    const file = layout.boards[seat];
    if (!file) return null;
    // ...
        <img
          className={styles.boardImg}
          src={`${layout.folder}/${file}`}
          alt={`${name(seat, seat)}'s board`}
          draggable={false}
        />
```

`playAreas` already has every player’s slots; opponents just never draw them.

### What “dynamic” should mean here

| Seat | Behavior |
|------|----------|
| `bottom` (you) | Keep interactive: select empty/occupied, place, discard-from-play |
| All other seats | Show occupied cards in the correct warped spots; **no** click-to-place |

Same 15 slot ids (`t01`–`t08`, `b01`–`b07`) and the same `PlayArea` map.

### Recommended approach

1. **Generalize `Plyr1PlayBoard` → something like `PlayBoard`**
   - Props: `occupied`, `artSeat`, `viewBox`, board fill/stroke paths, per-slot fill/stroke paths, `interactive?: boolean`
   - If `interactive === false`: render occupied overlays only; no selection/handlers

2. **Map screen seat → card art folder** (from your earlier plan):

| Screen seat | `playedSpotSrc` folder |
|-------------|------------------------|
| `bottom` | `plyr-bottom-center` |
| `top` | `plyr-top-center` |
| `left` / `right` | `plyrs-bottom-left-right` |
| `topLeft` / `topRight` | `plyrs-top-left-right` |

Extend `playedSpotSrc` beyond the two center seats.

3. **Wire opponents in `GameTable`**
   - Pass full `playAreas`
   - For each opponent seat: `occupied={playAreas[pidAt(seat)] ?? {}}`
   - Replace `board("top")` (etc.) with the dynamic component instead of `<img>`

4. **Extract paths from the board SVGs**  
   Opponent boards already have named groups (`t01`…`b07`). Same extraction you did for player-1 — don’t reuse player-1’s path coordinates; each seat’s geometry differs (e.g. 2p top viewBox is `0 0 177.84 44.34`).

### Start with 2-player `top` only

That’s the cleanest next step:
- Card art is already per-slot under `plyr-top-center/`
- Slot ids on `player-2-board-two-player-game.svg` are fixed
- One opponent seat to validate the data → overlay pipeline

### Caveat for 3–6 players

Side folders (`plyrs-*-left-right`) currently have **one** warped card set per row, not per-slot folders like the center seats. Until you generate `t01`…`b07` art there (or stretch the generic row art into each slot bbox), left/right/corner boards can’t look as correct as top/bottom.

---

I'm in **Ask mode**, so I can’t implement this. Switch to **Agent mode** if you want it built — I’d start with a read-only top-center board in 2-player games, then expand seats once that looks right.

---
## me
my plan for plyrs 3-6 is the further back cards are 3px smaller if that makese sense

--- 
## Cursor
Yes — that fits the side seats well, and it means you probably **don’t** need per-slot warp folders like `plyr-top-center`.

### How it maps to what you already have

`plyrs-*-left-right` already has **one** warped card set per row (`top-row/default_*.svg`, `bottom-row/default_*.svg`). For seats 3–6 you’d:

1. Place that same image in each slot’s bbox (`getBBox()` on the slot fill, same as `Plyr1PlayBoard`)
2. Scale it down **3px** for each step further back in depth

So perspective comes from **size steps**, not from 15 unique Illustrator warps.

### The one detail to lock

What is “further back”?

| Meaning | Example |
|--------|---------|
| **Along the row** (left↔right depth) | On a left seat, `t01` is front; `t08` is 7×3px smaller |
| **By row** (near vs far row) | Bottom row front; top row −3px (or vice versa) |
| **Both** | Row step + column step |

For angled side boards, “along the row toward vanishing point” is usually the one that reads correctly. Corner seats (`topLeft` / `topRight`) may need the same rule or a mirrored index.

### Implementation sketch (when you build it)

```ts
// e.g. depthIndex 0 = frontmost, 1 = next, …
const scale = 1 - (depthIndex * 3) / baseWidth; // or shrink width/height by 3*depthIndex
```

Keep one `default_${card}.svg` per row; only the `width`/`height` (or a `transform: scale`) changes per slot.

Center seats (`bottom` / `top`) stay as they are: true per-slot warps, no 3px ladder.

If you confirm whether the −3px is **per column along the row**, **per row**, or both, the seat→slot depth index is straightforward to define when you wire opponents.