## me
i am currently not able to draw, i dont believe that is connected to the updated svg, can you check for me? i think the same is for the discard and play boards

---
## Cursor
You’re right — this isn’t the hand SVG / `handCounts` work. Draw, discard, and play broke when the UI switched to **`GameTable`**.

### What’s wrong

`GameTable` only shows **static images** for draw/discard and seat boards — no click handlers:

```121:136:frontend/components/GameTable.tsx
      <div className={styles.draw}>
        <img
          className={styles.pileImg}
          src="/board-parts/dealer-boards/draw-pile-board.svg"
          ...
        />
      </div>
      <div className={styles.discard}>
        <img ... discard-pile-board.svg ... />
      </div>
```

The old interactive pieces still exist in `SessionScreen` (`drawDiscardSection` with `onDoubleClick`, and `Plyr1PlayBoard`), but **nothing renders them anymore** — only `<GameTable />` is on screen. Your bottom seat is also just a board SVG, not `Plyr1PlayBoard`, so play slots aren’t clickable either.

### What to do

Wire the existing handlers into `GameTable` (same double-click behavior as before):

1. Pass into `GameTable`: `onDraw`, `onDiscard`, `canDraw`, `canDiscard`, `topDiscard`, and for play: your `Plyr1PlayBoard` (or props it needs) on the **bottom** seat only.
2. On the draw `<img>`: `onDoubleClick={...}` when `canDraw`.
3. On discard: same pattern as `drawDiscardSection` (hand vs play selection).
4. Replace `board("bottom")` with the interactive `Plyr1PlayBoard` (view-only images for other seats is fine for now).

So: API/backend is fine; the table shell never got the interaction layer reattached after the layout refactor. Switch to Agent mode if you want that wiring applied for you.

---
## me
can we go step by step showing the code to add, first the mechanics for the draw board. Can you show me the code for that?

---
 ## Cursor
 Step 1 — **draw only**. Reuse your existing `handleDrawDblClick` / `canDraw`; just pass them into `GameTable`.

### 1. `GameTable.tsx` — add props

```tsx
type Props = {
  playerCount: number;
  seatPlayerIds: string[];
  roster: Record<string, string>;
  handBot?: ReactNode;
  handCounts?: Record<string, number>;
  canDraw?: boolean;
  onDraw?: () => void;
};
```

```tsx
export default function GameTable({
  playerCount,
  seatPlayerIds,
  roster,
  handBot,
  handCounts,
  canDraw = false,
  onDraw,
}: Props) {
```

### 2. `GameTable.tsx` — make the draw pile double-clickable

Replace the draw block with:

```tsx
      <div className={styles.draw}>
        <img
          className={styles.pileImg}
          src="/board-parts/dealer-boards/draw-pile-board.svg"
          alt="Draw pile"
          draggable={false}
          onDoubleClick={() => {
            if (!canDraw || !onDraw) return;
            onDraw();
          }}
          style={{ cursor: canDraw ? "pointer" : undefined }}
        />
      </div>
```

(`pointer-events: auto` is already on `.pileImg` in your table CSS.)

### 3. `SessionScreen.tsx` — pass the handlers

```tsx
      <GameTable
        playerCount={playerCount}
        seatPlayerIds={seatPlayerIds}
        roster={roster}
        handBot={myHandFan}
        handCounts={handCounts}
        canDraw={canDraw}
        onDraw={handleDrawDblClick}
      />
```

---

**Test:** start a game, double-click the draw board SVG. You should get a card in your hand (and pending highlight if that logic still runs).

Discard and play next once draw works.
---
## me
one thing i want to change is i want the outside fill of the board on the draw board to change to a light blue that i have already used and that indicates its selected. so here is how i want it to work, single click on draw it will highlight blue by boarder (which is a fill) turn light blue. Double click to pick up a card 
--- 
## Cursor
You’re matching play-slot selection: the **outline path is a fill**, and selected = `#5ac8fa` (same as `.slotSelected .slotStroke`).

In `draw-pile-board.svg` that’s the dark path (`cls-2` / `#143e1b`). The inner board fill is `cls-7`. Highlight **`cls-2`**.

You can’t recolor that with an `<img>` — inline the SVG (or a small component).

### Behavior

| Action | Result |
|---|---|
| Single click | Select draw → outline fill `#5ac8fa` |
| Double click | Draw a card (keep using `onDraw`) |

---

### 1. Small `DrawPileBoard.tsx`

```tsx
"use client";

type Props = {
  selected: boolean;
  canDraw: boolean;
  onSelect: () => void;
  onDraw: () => void;
  className?: string;
};

export default function DrawPileBoard({
  selected,
  canDraw,
  onSelect,
  onDraw,
  className,
}: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 44.46 44.08"
      aria-label="Draw pile"
      onClick={() => {
        if (!canDraw) return;
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        if (!canDraw) return;
        onDraw();
      }}
      style={{ cursor: canDraw ? "pointer" : undefined, display: "block", width: 44 }}
    >
      {/* paste paths from draw-pile-board.svg; only board chrome needs dynamic fill */}
      <g id="draw-board">
        {/* inner fill — stays green */}
        <path
          fill="#294c3e"
          d="M2.83,40.9c.23.35.64.55,1.09.55h36.63c.7,0,1.27-.51,1.27-1.14V3.78c0-.63-.57-1.14-1.27-1.14h-22.09c-.54,0-1.02.31-1.2.76L2.71,39.92c-.18.44,0,.8.11.97Z"
        />
        {/* outer “border” fill — selected → light blue */}
        <path
          fill={selected ? "#5ac8fa" : "#143e1b"}
          d="M3.91,44.08h36.63c2.16,0,3.91-1.69,3.91-3.78V3.78c0-2.08-1.75-3.78-3.91-3.78h-22.09c-1.61,0-3.07.97-3.65,2.42L.27,38.95c-.46,1.15-.32,2.4.38,3.43.73,1.07,1.95,1.71,3.27,1.71ZM18.46,2.64h22.09c.7,0,1.27.51,1.27,1.14v36.53c0,.63-.57,1.14-1.27,1.14H3.91c-.45,0-.86-.21-1.09-.55-.12-.17-.29-.53-.11-.97L17.26,3.4c.18-.45.66-.76,1.2-.76Z"
        />
      </g>
      {/* keep using the stacked cards from the SVG as an <image> overlay, or paste those paths too */}
      <image
        href="/board-parts/dealer-boards/draw-pile-board.svg"
        width="44.46"
        height="44.08"
        style={{ pointerEvents: "none" }}
      />
    </svg>
  );
}
```

The `<image>` overlay is a shortcut so you don’t paste every card path; if it looks muddy, paste the full `draw-pile-cards` group from the SVG instead and drop the `<image>`.

**Cleaner approach:** paste the whole SVG from the file into the component, change only the outer path’s `fill` as above, and delete the file’s `.cls-2` class on that path.

---

### 2. `GameTable` — selection state + wire draw

```tsx
type Props = {
  // ...existing
  canDraw?: boolean;
  onDraw?: () => void;
};
```

```tsx
import { useState } from "react";
import DrawPileBoard from "./DrawPileBoard";

// inside GameTable:
const [drawSelected, setDrawSelected] = useState(false);

// replace the draw <img> with:
<div className={styles.draw}>
  <DrawPileBoard
    className={styles.pileImg}
    selected={drawSelected}
    canDraw={!!canDraw}
    onSelect={() => setDrawSelected(true)}
    onDraw={() => onDraw?.()}
  />
</div>
```

Optional: clear highlight after a successful draw by having `onDraw` return a promise and then `setDrawSelected(false)`.

---

### 3. `SessionScreen` — same as before

```tsx
canDraw={canDraw}
onDraw={handleDrawDblClick}
```

---

**Interaction note:** use `onSelect={() => setDrawSelected(true)}` (set true, don’t toggle). A double-click fires two clicks then `dblclick`; toggling would unselect on the second click.

Once this looks right, discard can use the same select → highlight → double-click pattern.

---
## me
are you sure you cant just use the svg and not have to create a new path?

---
## Cursor
You don’t need a **new** path. You can keep the same SVG file and the same shapes.

What you **can’t** do is recolor one fill inside:

```tsx
<img src="/board-parts/dealer-boards/draw-pile-board.svg" />
```

Browsers treat that as a flat image, so page CSS can’t touch `.cls-2`.

### What works (same SVG, no new geometry)

**1. Inline the existing file** (SVGR import or paste-as-component — paths stay as-is).

**2. Optionally tag the border path in that file** (not redraw it), e.g. keep the same `d=...`, just make the selector stable:

```svg
<path class="cls-2 draw-board-stroke" d="M3.91,44.08..."/>
```

**3. Toggle a wrapper class** and override fill in CSS:

```css
.drawSelected :global(.cls-2),
.drawSelected :global(.draw-board-stroke) {
  fill: #5ac8fa;
}
```

```tsx
<div
  className={`${styles.draw} ${drawSelected ? styles.drawSelected : ""}`}
  onClick={() => canDraw && setDrawSelected(true)}
  onDoubleClick={() => canDraw && onDraw?.()}
>
  <DrawPileBoardSvg className={styles.pileImg} />
</div>
```

So: **same SVG, same paths** — just inline + CSS on selected. My earlier “new path” wording was only because an `<img>` can’t be restyled; the geometry you already have is enough.

---
## me
so in adobe illustrator its called discard-board then compound path. is that something i can use to make this more simple?  

---
## Cursor
Yes. That Illustrator name is already useful.

In your exported SVGs it shows up as an **id** on a group:

```24:27:frontend/public/board-parts/dealer-boards/discard-pile-board.svg
      <g id="discard-board">
        <path class="cls-4" d="..."/>  <!-- inner fill -->
        <path class="cls-2" d="..."/>  <!-- outer “border” fill -->
      </g>
```

Draw has the same idea: `id="draw-board"`.

So you don’t invent new geometry — you target what AI already named.

### How it simplifies things

When the SVG is **inlined** (not `<img>`):

```css
.selected :global(#draw-board) .cls-2,
.selected :global(#discard-board) .cls-2 {
  fill: #5ac8fa;
}
```

Or, cleaner in Illustrator: name the **compound path itself** something like `draw-board-stroke` so export is:

```svg
<path id="draw-board-stroke" d="..."/>
```

Then:

```css
.selected :global(#draw-board-stroke) {
  fill: #5ac8fa;
}
```

### What it does *not* skip

The id still only works if the SVG is in the DOM (inline / SVGR). An `<img src="...svg">` won’t see `#discard-board`.

**Bottom line:** yes — use `draw-board` / `discard-board` (or a named compound path id) as your selector. Same art, simpler targeting, no new paths.
---
## me
so show me the code that makes the most sense for scalability and maintainability with this project since I will be using this for all the slots for draw, discard and playing spots

---
## Cursor
Yes — and the scalable version is basically what you already do on play slots, applied everywhere.

### Pattern you already have (keep it)

Play spots: **group + fill path + stroke path**, selected → stroke fill `#5ac8fa`:

```177:179:frontend/components/SessionScreen.module.css
  .slotSelected .slotStroke {
    fill: #5ac8fa;
  }
```

Draw/discard Illustrator groups already match that shape (`#draw-board` / `#discard-board` = fill + outer stroke fill). Name the stroke path `board-stroke` in AI so every asset shares one CSS rule.

---

### Shared contract (Illustrator → SVG)

| Layer | Name / class | Role |
|---|---|---|
| Group | `draw-board`, `discard-board`, `t01`… | click target |
| Inner shape | `board-fill` | green fill |
| Outer ring | `board-stroke` | “border” fill → turns `#5ac8fa` when selected |

One CSS rule for draw, discard, and every play slot.

---

### 1. Shared styles — `BoardInteraction.module.css`

```css
.zone {
  cursor: pointer;
}

.zone:global(.selected) :global(.board-stroke),
.selected :global(.board-stroke) {
  fill: #5ac8fa;
}

/* piles sized like your current .pileImg */
.pileSvg {
  display: block;
  width: 44px;
  height: auto;
  pointer-events: auto;
  user-select: none;
}
```

---

### 2. Shared interaction helper

```ts
// boardInteraction.ts
export type BoardAction = {
  canUse: boolean;
  selected: boolean;
  onSelect: () => void;
  onActivate: () => void; // double-click: draw / discard / place
};

export function boardPointerProps(action: BoardAction) {
  return {
    className: action.selected ? "selected" : undefined,
    style: { cursor: action.canUse ? "pointer" : undefined },
    onClick: () => {
      if (!action.canUse) return;
      action.onSelect(); // set true, don't toggle (dblclick-safe)
    },
    onDoubleClick: (e: React.MouseEvent) => {
      e.preventDefault();
      if (!action.canUse) return;
      action.onActivate();
    },
  };
}
```

---

### 3. Pile component (draw + discard) — inline SVG file once

```tsx
// SelectablePileBoard.tsx
"use client";

import { useEffect, useState } from "react";
import styles from "./BoardInteraction.module.css";
import { boardPointerProps, type BoardAction } from "./boardInteraction";

type Props = {
  /** e.g. /board-parts/dealer-boards/draw-pile-board.svg */
  src: string;
  /** e.g. draw-board | discard-board */
  boardGroupId: string;
  action: BoardAction;
};

export default function SelectablePileBoard({ src, boardGroupId, action }: Props) {
  const [markup, setMarkup] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((r) => r.text())
      .then((text) => {
        if (cancelled) return;
        // keep inner content only
        const inner = text.replace(/^[\s\S]*?<svg[^>]*>/i, "").replace(/<\/svg>[\s\S]*$/i, "");
        setMarkup(inner);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const pointer = boardPointerProps(action);

  return (
    <svg
      viewBox="0 0 44.46 44.08"
      className={`${styles.pileSvg} ${pointer.className ?? ""}`}
      style={pointer.style}
      onClick={pointer.onClick}
      onDoubleClick={pointer.onDoubleClick}
      aria-label={boardGroupId}
      // SVG from AI; board-stroke class must exist on the outer path
      dangerouslySetInnerHTML={markup ? { __html: markup } : undefined}
    />
  );
}
```

In Illustrator, set the compound-path / outer ring class to **`board-stroke`** (and optionally rename fill to `board-fill`). Re-export. No new paths.

**GameTable usage:**

```tsx
const [drawSelected, setDrawSelected] = useState(false);

<div className={styles.draw}>
  <SelectablePileBoard
    src="/board-parts/dealer-boards/draw-pile-board.svg"
    boardGroupId="draw-board"
    action={{
      canUse: !!canDraw,
      selected: drawSelected,
      onSelect: () => setDrawSelected(true),
      onActivate: () => onDraw?.(),
    }}
  />
</div>
```

Same component for discard with `discard-pile-board.svg` + `discard-board`.

---

### 4. Play boards (scalability) — same CSS, don’t hardcode every seat

Long-term, stop duplicating paths like `Plyr1PlayBoard`. Load each seat SVG and bind groups `t01`…`b07`:

```tsx
// sketch — InteractiveSeatBoard
// 1) fetch/inline player-N-board-....svg
// 2) for each #t01…#b07 group:
//    - ensure child stroke path has class board-stroke (AI export)
//    - onClick → select that slot
//    - onDoubleClick → place/activate
//    - toggle class "selected" on the <g>
// 3) CSS: .selected .board-stroke { fill: #5ac8fa }
```

That’s one component for **all** seat boards (bottom interactive, others view-only).

Until then, keep `Plyr1PlayBoard` as-is — it already follows this fill/stroke/selected model; just align naming to `board-stroke` when you can.

---

### Why this is the maintainable choice

| Approach | Verdict |
|---|---|
| `<img>` + CSS | Can’t recolor stroke |
| Copy paths into React per board | Doesn’t scale to 21 boards |
| **AI ids + `board-stroke` + inline SVG + shared `.selected` CSS** | One interaction model for draw, discard, and every slot |

### Illustrator checklist (do once)

1. Outer ring / compound path → class **`board-stroke`**  
2. Inner fill → **`board-fill`** (optional)  
3. Keep group ids: `draw-board`, `discard-board`, `t01`…  
4. Re-export SVGs  

Then React only toggles **`selected`**; art stays in the files.

I can next show the exact discard wiring with the same `SelectablePileBoard`, or the seat-board loader sketch in more detail — whichever you want next.

--- 
## me
i dont want to have to rename in adobe illustrator, does the code you sent still work?

--- 
## Cursor
**Short answer:** the approach works **without renaming in Illustrator**, but the CSS I showed that targets `.board-stroke` will **not** — that class isn’t in your files today.

Your exports already have usable hooks:

```svg
<g id="draw-board">
  <path class="cls-7" .../>  <!-- inner fill -->
  <path class="cls-2" .../>  <!-- outer “border” fill -->
</g>
```

Same idea for `#discard-board`.

### Use what AI already exports

```css
/* BoardInteraction.module.css */
.selected :global(#draw-board) path:last-of-type,
.selected :global(#discard-board) path:last-of-type {
  fill: #5ac8fa;
}
```

Or, equivalently for these two files (outer ring is `.cls-2`):

```css
.selected :global(#draw-board) .cls-2,
.selected :global(#discard-board) .cls-2 {
  fill: #5ac8fa;
}
```

`SelectablePileBoard` stays the same (fetch + inline + toggle `.selected`). Only the CSS selector changes — **no Illustrator rename**.

### Caveat for play slots later

`path:last-of-type` only works if every slot group is always **fill then stroke**. Your dealer piles are. For seat boards (`#t01`, …), confirm that order once; if it’s consistent, the same rule scales:

```css
.selected :global(#t01) path:last-of-type,
/* or more general: */
g.selected > path:last-of-type {
  fill: #5ac8fa;
}
```

**Bottom line:** skip AI renames; target `#draw-board` / `#discard-board` (and later slot group ids). Drop `.board-stroke` unless you add that class later for clarity.

---
## me
so show me all the code again

--- 
## Cursor
Here’s the full draw-focused package (no Illustrator renames). Discard can reuse the same component later.

---

### 1. `frontend/components/boardInteraction.ts`

```ts
import type { CSSProperties, MouseEvent } from "react";

export type BoardAction = {
  canUse: boolean;
  selected: boolean;
  onSelect: () => void;
  onActivate: () => void; // double-click: draw / discard / place
};

export function boardPointerProps(action: BoardAction): {
  className?: string;
  style: CSSProperties;
  onClick: () => void;
  onDoubleClick: (e: MouseEvent) => void;
} {
  return {
    className: action.selected ? "selected" : undefined,
    style: { cursor: action.canUse ? "pointer" : undefined },
    onClick: () => {
      if (!action.canUse) return;
      action.onSelect(); // set true — don't toggle (dblclick-safe)
    },
    onDoubleClick: (e) => {
      e.preventDefault();
      if (!action.canUse) return;
      action.onActivate();
    },
  };
}
```

---

### 2. `frontend/components/BoardInteraction.module.css`

```css
.pileSvg {
  display: block;
  width: 44px;
  height: auto;
  pointer-events: auto;
  user-select: none;
}

/*
  Existing AI export: #draw-board / #discard-board
  = [inner fill path, outer border fill path]
  No rename needed — last path is the “border” fill.
*/
.pileSvg:global(.selected) :global(#draw-board) path:last-of-type,
.pileSvg:global(.selected) :global(#discard-board) path:last-of-type {
  fill: #5ac8fa;
}
```

---

### 3. `frontend/components/SelectablePileBoard.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import styles from "./BoardInteraction.module.css";
import { boardPointerProps, type BoardAction } from "./boardInteraction";

type Props = {
  /** e.g. /board-parts/dealer-boards/draw-pile-board.svg */
  src: string;
  action: BoardAction;
  label?: string;
};

export default function SelectablePileBoard({ src, action, label }: Props) {
  const [markup, setMarkup] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((r) => r.text())
      .then((text) => {
        if (cancelled) return;
        const inner = text
          .replace(/^[\s\S]*?<svg[^>]*>/i, "")
          .replace(/<\/svg>[\s\S]*$/i, "");
        setMarkup(inner);
      })
      .catch(() => {
        if (!cancelled) setMarkup("");
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const pointer = boardPointerProps(action);

  return (
    <svg
      viewBox="0 0 44.46 44.08"
      className={`${styles.pileSvg}${pointer.className ? ` ${pointer.className}` : ""}`}
      style={pointer.style}
      onClick={pointer.onClick}
      onDoubleClick={pointer.onDoubleClick}
      aria-label={label ?? "pile"}
      dangerouslySetInnerHTML={markup ? { __html: markup } : undefined}
    />
  );
}
```

---

### 4. `GameTable.tsx` — draw wiring

**Imports / props:**

```tsx
"use client";

import { useState, type ReactNode } from "react";
import OpponentHand from "./OpponentHand";
import SelectablePileBoard from "./SelectablePileBoard";
import { LAYOUTS, type SeatKey } from "./tableLayouts";
// ... existing style imports ...

type Props = {
  playerCount: number;
  seatPlayerIds: string[];
  roster: Record<string, string>;
  handBot?: ReactNode;
  handCounts?: Record<string, number>;
  canDraw?: boolean;
  onDraw?: () => void;
};
```

**Destructure + state** (inside the component, with your other hooks):

```tsx
export default function GameTable({
  playerCount,
  seatPlayerIds,
  roster,
  handBot,
  handCounts,
  canDraw = false,
  onDraw,
}: Props) {
  const [drawSelected, setDrawSelected] = useState(false);

  // ... existing n, styles, layout, order, countForSeat, name, board ...
```

**Replace the draw `<img>` block with:**

```tsx
      <div className={styles.draw}>
        <SelectablePileBoard
          src="/board-parts/dealer-boards/draw-pile-board.svg"
          label="Draw pile"
          action={{
            canUse: canDraw,
            selected: drawSelected,
            onSelect: () => setDrawSelected(true),
            onActivate: () => onDraw?.(),
          }}
        />
      </div>
```

Leave discard as the static `<img>` for now.

---

### 5. `SessionScreen.tsx` — pass draw handlers

You already have `canDraw` and `handleDrawDblClick`. Wire them:

```tsx
      <GameTable
        playerCount={playerCount}
        seatPlayerIds={seatPlayerIds}
        roster={roster}
        handBot={myHandFan}
        handCounts={handCounts}
        canDraw={canDraw}
        onDraw={handleDrawDblClick}
      />
```

---

### Behavior

| Action | Result |
|---|---|
| Single click (when `canDraw`) | Outer board ring → `#5ac8fa` |
| Double click | Runs `handleDrawDblClick` → draws a card |

### Later (same component)

```tsx
<SelectablePileBoard
  src="/board-parts/dealer-boards/discard-pile-board.svg"
  label="Discard pile"
  action={{ /* canDiscard, discardSelected, onDiscard */ }}
/>
```

No Illustrator renames required.

---
## me
if i single click the draw pile i want it to deselect. will that be possible and able to tell the difference between two single clicks and a double click?

--- 
## Cursor
Yes for **deselect on single click**, but not with “toggle immediately on every `click` + native `dblclick`.”

A double-click always fires:

`click` → `click` → `dblclick`

So if each `click` toggles right away, a double-click will select then deselect (or the reverse) before `dblclick` runs. The browser can’t label the first click as “part of a double” until the second one arrives.

### What works

**Delay the single-click** (~250–300ms). If a second click comes in time, treat it as a double (draw) and **don’t** run the single-click toggle.

```ts
// boardInteraction.ts — replace boardPointerProps click handling

let clickTimer: ReturnType<typeof setTimeout> | null = null;
let clicks = 0;

export function boardPointerProps(action: BoardAction) {
  return {
    className: action.selected ? "selected" : undefined,
    style: { cursor: action.canUse ? "pointer" : undefined },
    onClick: () => {
      if (!action.canUse) return;

      clicks += 1;
      if (clicks === 1) {
        clickTimer = setTimeout(() => {
          clicks = 0;
          clickTimer = null;
          // single click: toggle select
          if (action.selected) action.onDeselect();
          else action.onSelect();
        }, 250);
      } else if (clicks === 2) {
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = null;
        clicks = 0;
        // double click: draw (no toggle)
        action.onActivate();
      }
    },
    // optional: block text-select flash
    onDoubleClick: (e: React.MouseEvent) => e.preventDefault(),
  };
}
```

Extend the action type:

```ts
export type BoardAction = {
  canUse: boolean;
  selected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onActivate: () => void;
};
```

In `GameTable`:

```tsx
action={{
  canUse: canDraw,
  selected: drawSelected,
  onSelect: () => setDrawSelected(true),
  onDeselect: () => setDrawSelected(false),
  onActivate: () => onDraw?.(),
}}
```

### Tradeoff

Single-click highlight waits ~250ms. That’s normal for click-vs-dblclick UIs.

**Bottom line:** deselect on single click is fine; use a short delay to tell single vs double apart. Don’t toggle on every raw `click` if you also need double-click to draw.