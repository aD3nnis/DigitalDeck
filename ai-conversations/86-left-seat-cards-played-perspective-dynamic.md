## me
ok lets work on a 3 player game then and get the perspective of the cards correct for that left seat
---
## Cursor
For 3-player left seat, this is the same pattern as top — a view-only play board — but with **flat row assets** and your **3px depth** rule instead of per-slot warps.

## Current gap

In 3P, left is still static:

```231:231:frontend/components/GameTable.tsx
      {board("left")}
```

`areaForSeat("left")` already resolves the right player’s `playAreas`. Nothing draws them.

Left board art is identical across 3–6P (`viewBox="0 0 132.87 111.62"`), so one left component covers all those layouts.

## What to build

### 1. Extend `playedSpotSrc` for side seats

Center seats use per-slot folders; side seats do not:

```
/played-card-spots/plyrs-bottom-left-right/{top-row|bottom-row}/default_${card}.svg
```

Use **`plyrs-bottom-left-right`** for 3P left (board id is `bottom-left-board`). `plyrs-top-left-right` is for topLeft/topRight later.

### 2. New `PlyrLeftPlayBoard.tsx` (view-only)

Copy the `PlyrTopPlayBoard` shape:

- Trap + slot paths from `player-2-board-three-player-game.svg` (`cls-3`/`cls-1` trap, each slot’s fill then stroke)
- `occupied` only — no click handlers
- Place card via `getBBox()` like top/bottom

Then apply depth:

```ts
// depthIndex 0 = frontmost
const shrink = depthIndex * 3;
const w = Math.max(0, box.width - shrink);
const h = Math.max(0, box.height - shrink);
// center the shrunk image in the slot bbox
const x = box.x + (box.width - w) / 2;
const y = box.y + (box.height - h) / 2;
```

**Depth direction to lock (looks like):** on the left board, `01` is toward the narrow/far end and `07`/`08` toward the wide/near end, so:

| Slot | depthIndex (front = 0) |
|------|------------------------|
| `b07` / `t08` | 0 |
| `b06` / `t07` | 1 |
| … | … |
| `b01` / `t01` | 6 / 7 |

If that reads backwards in the UI, flip the index.

### 3. Wire in `GameTable`

Replace `board("left")` with the same pattern as top:

```tsx
{layout.boards.left && (
  <div className={`${styles.seat} ${styles.left}`}>
    <span className={styles.playerLabel}>
      {name("left", "left")} ({seatNumber("left")})
    </span>
    <div className={sessionStyles.opponentPlayBoard /* + left aspect */}>
      <PlyrLeftPlayBoard occupied={areaForSeat("left")} />
    </div>
  </div>
)}
```

CSS: left needs `aspect-ratio: 132.87 / 111.62` (not the top board’s ratio).

## Scope for this pass

- **Do:** left seat only in 3P (right can mirror next)
- **Don’t:** join/leave logic yet — once left renders `areaForSeat("left")`, 2→3 remap should already show ply2’s cards on the left

I’m in **Ask mode**, so I can’t edit the repo. Switch to **Agent mode** and we can implement left first; if you want a different depth mapping (column-only vs also row), say so before we start.

--- 
## me
ok i think see what is part of the plroblem. the cards are suppose to overlap which is see they are shrinking their width to make space between the cards. Do you see in the svg how they overlap a bit? I need that overlapping to be present

--- 
## Cursor
Yes — the SVG slots already overlap. The depth shrink is what’s opening gaps.

## What the SVG does

On the left board, each row is stacked and neighbors share space. Rough overlaps:

| Pair | Y overlap |
|------|-----------|
| b01–b02 | ~7px |
| b06–b07 | ~10px |
| t01–t02 | ~10px |
| t07–t08 | ~16px |

If you draw cards at full `getBBox()` size, they should overlap like the board art.

## What your code does instead

In `PlyrLeftPlayBoard.tsx`:

```51:55:frontend/components/PlyrLeftPlayBoard.tsx
  const shrink = depthIndex(slot.id) * DEPTH_PX;
  const w = box ? Math.max(0, box.width - shrink) : 0;
  const h = box ? Math.max(0, box.height - shrink) : 0;
  const x = box ? box.x + (box.width - w) / 2 : 0;
  const y = box ? box.y + (box.height - h) / 2 : 0;
```

With `DEPTH_PX = 3`:

- `b01` depth = 6 → shrink **18px** on a slot only ~19px tall → card almost vanishes  
- Centering that shrink on **both** width and height pulls cards inward → gaps instead of overlap  

So it isn’t “making space between cards” on purpose — it’s over-shrinking past the natural overlap.

## Where to tweak

**File:** `frontend/components/PlyrLeftPlayBoard.tsx`

1. **Restore overlap (try this first)** — use full bbox, no depth:

```tsx
<image
  href={playedSpotSrc("plyrs-bottom-left-right", slot.id, card)}
  x={box.x}
  y={box.y}
  width={box.width}
  height={box.height}
  preserveAspectRatio="none"
  pointerEvents="none"
/>
```

Or set `DEPTH_PX = 0`.

2. **If you still want a 3px depth cue** — don’t shrink from center on both axes. The slot paths already get larger toward the front (`b01` ~18px tall → `b07` ~25px). Extra depth should be subtle, e.g. only a little scale, or only height, anchored toward the front edge — not `depth * 3` off width and height.

3. **Paint order** — keep front slots later in the DOM (`b07`/`t08` after `b01`/`t01`) so overlaps stack correctly. Your current `SLOTS` order already does that.

**Bottom line:** overlap lives in the slot geometry. Turn off (or heavily soften) the depth shrink so cards fill their overlapping boxes again.

--- 
## me
ok that fixes the problem if i change the aspect ratio as well it will make the image larger and better. However there is another problem. I need to make sure that any empt slots are behind cards that are played because currently it looks weird that the card being played is behind an empty slot. Also i saw the stroke (possibly fill) on the empty slots changed color to being the same as the inside color which i dont want

--- 
## Cursor
Both issues come from how empty slots are drawn in the overlapping stack.

## 1. Empty slots covering cards

In `PlyrLeftPlayBoard.tsx`, every slot is one group in `SLOTS` order (`b01` → `b07`, then `t01` → `t08`). Later groups paint on top.

So if `b05` has a card and `b06` is empty, `b06`’s opaque fill is drawn **after** `b05` and covers the overlap. That’s the “card behind empty slot” look.

**Fix:** two passes — empties first, cards second:

```tsx
{/* pass 1: empty slots only */}
{SLOTS.filter((s) => !occupied[s.id]).map((slot) => (
  <OccupiedSlot key={slot.id} slot={slot} card={undefined} />
))}

{/* pass 2: occupied on top */}
{SLOTS.filter((s) => occupied[s.id]).map((slot) => (
  <OccupiedSlot key={slot.id} slot={slot} card={occupied[slot.id]} />
))}
```

Within an occupied group, keep the card `<image>` **after** the fill/stroke paths (or keep fill as `slotHit` / transparent) so the ring doesn’t sit on top of the art. Top board has the same cross-slot risk; same two-pass fix helps there too.

## 2. Empty slot stroke same color as fill

In `SessionScreen.module.css`:

```35:38:frontend/components/SessionScreen.module.css
  .slotFill,
  .slotStroke {
    fill: #3d705e;
    pointer-events: fill;
  }
```

Fill and stroke share `#3d705e`, so the outline disappears into the pad.

Original left-board art uses different greens:

| Role | SVG class | Color |
|------|-----------|--------|
| Slot interior | `cls-4` | `#336857` |
| Slot outline | `cls-2` | `#153c2d` |

**Fix:** split the colors, e.g.:

```css
.slotFill {
  fill: #336857; /* or keep #3d705e if you prefer that pad */
  pointer-events: fill;
}

.slotStroke {
  fill: #153c2d; /* darker ring — not the same as fill */
  pointer-events: fill;
}
```

Occupied slots already hide both via `.slotOccupied … { fill: none }`, so this only affects empties.

---

**Where to edit**

| Problem | File |
|---------|------|
| Cards under empty slots | `PlyrLeftPlayBoard.tsx` — two-pass render |
| Outline color | `SessionScreen.module.css` — separate `.slotFill` / `.slotStroke` |

I’m in Ask mode; switch to Agent if you want these applied in the repo.