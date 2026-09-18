## me
ok so thats working, now give me the code to make the dealer board dynamic

--- 
## Cursor
Here’s a frontend-first cut that replaces the static dealer `<img>` with interactive `d01`–`d05` slots (same pattern as `Plyr1PlayBoard`). Backend sync is noted at the end — without it, cards only exist in local React state.

---

### 1. `frontend/components/DealerPlayBoard.tsx` (new)

```tsx
"use client";

import { useLayoutEffect, useRef, useState } from "react";
import styles from "./SessionScreen.module.css";
import { playedSpotSrc } from "./CardAssets";
import type { DealerArea, DealerSlotId } from "./types";

export const DEALER_SLOT_IDS = ["d01", "d02", "d03", "d04", "d05"] as const;

type SlotPaths = { id: DealerSlotId; fill: string; stroke: string };

const SLOTS: SlotPaths[] = [
  {
    id: "d01",
    fill: "M4.23,32.37L17.49,3.87c.24-.51,1.11-.93,1.93-.93l27.23-.07c.83,0,1.39.41,1.24.93l-8.09,28.57c-.2.71-1.17,1.3-2.15,1.3H5.4c-.98,0-1.51-.58-1.18-1.29Z",
    stroke:
      "M46.66,2.87v.76s0,.24,0,.24c.07,0,.13,0,.18.01l-7.99,28.22c-.06.2-.56.57-1.19.57H5.4c-.08,0-.15,0-.2-.02L18.39,4.31c.09-.13.53-.37,1.04-.37l27.23-.07v-1M46.66,2.87h0l-27.23.07c-.83,0-1.69.42-1.93.93l-13.27,28.51c-.33.71.2,1.29,1.18,1.29h32.25c.99,0,1.95-.58,2.15-1.3L47.9,3.8c.15-.51-.41-.93-1.24-.93h0Z",
  },
  {
    id: "d02",
    fill: "M41.29,32.4L49.57,3.81c.15-.53.94-.96,1.75-.96h26.59c.81,0,1.41.43,1.34.96l-4.01,28.59c-.1.7-.94,1.27-1.88,1.27h-30.74c-.94,0-1.53-.57-1.33-1.27Z",
    stroke:
      "M77.9,3.85c.14,0,.24.02.31.05l-3.98,28.37c-.02.1-.36.4-.89.4h-30.74c-.17,0-.29-.03-.35-.06l8.25-28.48c.08-.09.39-.27.8-.27h26.59M77.9,2.85h-26.59c-.81,0-1.59.43-1.75.96l-8.28,28.59c-.2.7.4,1.27,1.33,1.27h30.74c.94,0,1.78-.57,1.88-1.27l4.01-28.59c.07-.53-.53-.96-1.34-.96h0Z",
  },
  {
    id: "d03",
    fill: "M114.38,32.27l-3.91-28.55c-.07-.48-.78-.86-1.58-.86h-26.52c-.81,0-1.52.39-1.58.86l-3.91,28.55c-.11.77.65,1.4,1.69,1.4h34.12c1.04,0,1.8-.63,1.69-1.4Z",
    stroke:
      "M108.89,3.85c.3,0,.51.08.61.14l3.89,28.41c-.01.05-.23.26-.7.26h-34.12c-.48,0-.69-.21-.7-.27l3.89-28.41c.1-.06.32-.14.61-.14h26.52M108.89,2.85h-26.52c-.81,0-1.52.39-1.58.86l-3.91,28.55c-.11.77.65,1.4,1.69,1.4h34.12c1.04,0,1.8-.63,1.69-1.4l-3.91-28.55c-.07-.48-.78-.86-1.58-.86h0Z",
  },
  {
    id: "d04",
    fill: "M149.93,32.4l-8.28-28.59c-.15-.53-.94-.96-1.75-.96h-26.59c-.81,0-1.41.43-1.34.96l4.01,28.59c.1.7.94,1.27,1.88,1.27h30.74c.94,0,1.53-.57,1.33-1.27Z",
    stroke:
      "M139.9,3.85c.41,0,.72.18.8.27l8.25,28.48c-.06.03-.18.06-.35.06h-30.74c-.53,0-.86-.3-.89-.4l-3.98-28.37c.07-.02.18-.04.31-.04h26.59M139.9,2.85h-26.59c-.81,0-1.41.43-1.34.96l4.01,28.59c.1.7.94,1.27,1.88,1.27h30.74c.94,0,1.53-.57,1.33-1.27l-8.28-28.59c-.15-.53-.94-.96-1.75-.96h0Z",
  },
  {
    id: "d05",
    fill: "M186.99,32.37l-13.27-28.51c-.24-.51-1.11-.93-1.93-.93l-27.23-.07c-.83,0-1.39.41-1.24.93l8.09,28.57c.2.71,1.17,1.3,2.15,1.3h32.25c.98,0,1.51-.58,1.18-1.29Z",
    stroke:
      "M144.56,2.87v1s27.23.07,27.23.07c.51,0,.95.25,1.03.36l13.2,28.36c-.05,0-.12.02-.20.02h-32.25c-.63,0-1.14-.37-1.19-.57l-7.99-28.22s.11-.01.18-.01v-1M144.56,2.87c-.83,0-1.38.41-1.24.93l8.09,28.57c.2.71,1.17,1.3,2.15,1.3h32.25c.98,0,1.51-.58,1.18-1.29l-13.27-28.51c-.24-.51-1.11-.93-1.93-.93l-27.23-.07h0Z",
  },
];

type Props = {
  occupied: DealerArea;
  emptySelected: DealerSlotId[];
  playSelected: DealerSlotId[];
  onSelectEmpty: (id: DealerSlotId) => void;
  onSelectOccupied: (id: DealerSlotId) => void;
  onPlace: (id: DealerSlotId) => void;
};

function Slot({
  slot,
  card,
  emptySelected,
  occupiedSelected,
  onSelectEmpty,
  onSelectOccupied,
  onPlace,
}: {
  slot: SlotPaths;
  card: string | undefined;
  emptySelected: boolean;
  occupiedSelected: boolean;
  onSelectEmpty: () => void;
  onSelectOccupied: () => void;
  onPlace: () => void;
}) {
  const fillRef = useRef<SVGPathElement>(null);
  const [box, setBox] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (fillRef.current) setBox(fillRef.current.getBBox());
  }, [slot.fill]);
  const selected = card ? occupiedSelected : emptySelected;

  return (
    <g
      className={`${styles.slotGroup} ${card ? styles.slotOccupied : ""} ${
        selected ? styles.slotSelected : ""
      }`}
      onClick={card ? onSelectOccupied : onSelectEmpty}
      onDoubleClick={card ? undefined : onPlace}
    >
      {card && box && (
        <image
          href={playedSpotSrc("dealer", slot.id, card)}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          preserveAspectRatio="none"
          pointerEvents="none"
        />
      )}
      <path
        ref={fillRef}
        className={card ? styles.slotHit : styles.slotFill}
        d={slot.fill}
      />
      <path className={styles.slotStroke} d={slot.stroke} />
    </g>
  );
}

export default function DealerPlayBoard({
  occupied,
  emptySelected,
  playSelected,
  onSelectEmpty,
  onSelectOccupied,
  onPlace,
}: Props) {
  return (
    <svg
      className={styles.dealerPlayBoardSvg}
      viewBox="0 0 191.09 36.3"
      aria-hidden="true"
    >
      <g id="dealer-board" style={{ pointerEvents: "none" }}>
        <path
          className={styles.trapFill}
          d="M188.26,33.15c.1-.16.31-.57.09-1.08l-12.48-28.75c-.18-.42-.59-.69-1.05-.69H16.08c-.46,0-.87.27-1.05.69L2.73,32.08c-.15.36-.12.75.1,1.08s.56.51.95.51h183.53c.56,0,.85-.36.95-.52Z"
        />
        <path
          className={styles.trapStroke}
          d="M190.46,34.6c.7-1.07.82-2.41.31-3.58l-12.48-28.75c-.6-1.38-1.96-2.27-3.47-2.27H16.08c-1.51,0-2.88.9-3.47,2.29L.31,31.04c-.5,1.17-.38,2.5.32,3.57.7,1.06,1.88,1.7,3.15,1.7h183.53c1.28,0,2.46-.64,3.16-1.71ZM2.83,33.15c-.22-.33-.25-.72-.1-1.08L15.03,3.33c.18-.42.59-.69,1.05-.69h158.75c.46,0,.87.27,1.05.69l12.48,28.75c.22.51,0,.93-.09,1.08s-.4.52-.95.52H3.78c-.39,0-.74-.19-.95-.51Z"
        />
      </g>
      {SLOTS.map((slot) => (
        <Slot
          key={slot.id}
          slot={slot}
          card={occupied[slot.id]}
          emptySelected={emptySelected.includes(slot.id)}
          occupiedSelected={playSelected.includes(slot.id)}
          onSelectEmpty={() => onSelectEmpty(slot.id)}
          onSelectOccupied={() => onSelectOccupied(slot.id)}
          onPlace={() => onPlace(slot.id)}
        />
      ))}
    </svg>
  );
}
```

---

### 2. `types.ts` — add dealer types

```ts
export type DealerSlotId = "d01" | "d02" | "d03" | "d04" | "d05";
export type DealerArea = Partial<Record<DealerSlotId, string>>;
```

---

### 3. `CardAssets.ts` — dealer seat

```ts
export function playedSpotSrc(
  seat:
    | "plyr-bottom-center"
    | "plyr-top-center"
    | "plyrs-bottom-left-right"
    | "plyrs-top-left-right"
    | "dealer",
  slotId: string,
  cardId: string,
  side: "left" | "right" = "left",
): string {
  if (seat === "dealer") {
    return `/played-card-spots/dealer/${slotId}/default_${cardId}.svg`;
  }
  // ...existing logic unchanged
}
```

---

### 4. `SessionScreen.module.css` — size the SVG like the old img

```css
.dealerPlayBoard {
  position: relative;
  width: 100%;
  aspect-ratio: 191.09 / 36.3;
  pointer-events: none; /* slots re-enable via .slotFill / .slotHit */
}

.dealerPlayBoardSvg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
```

(Reuse existing `.slotFill` / `.slotHit` / `.slotSelected` — they already set `pointer-events: fill`.)

---

### 5. `GameTable.tsx` — replace the static img

Props to add:

```ts
import DealerPlayBoard from "./DealerPlayBoard";
import type { DealerArea, DealerSlotId } from "./types";

// on Props:
dealerArea?: DealerArea;
dealerEmptySelected?: DealerSlotId[];
dealerPlaySelected?: DealerSlotId[];
onSelectDealerEmpty?: (id: DealerSlotId) => void;
onSelectDealerOccupied?: (id: DealerSlotId) => void;
onDealerPlace?: (id: DealerSlotId) => void;
```

Replace the dealer seat body:

```tsx
<div className={`${styles.seat} ${styles.dealer}`}>
  <div className={sessionStyles.dealerPlayBoard}>
    <DealerPlayBoard
      occupied={dealerArea ?? {}}
      emptySelected={dealerEmptySelected ?? []}
      playSelected={dealerPlaySelected ?? []}
      onSelectEmpty={(id) => onSelectDealerEmpty?.(id)}
      onSelectOccupied={(id) => onSelectDealerOccupied?.(id)}
      onPlace={(id) => onDealerPlace?.(id)}
    />
  </div>
</div>
```

---

### 6. `SessionScreen.tsx` — selection + place + discard (same rules as player play)

```tsx
import type { DealerArea, DealerSlotId } from "./types";

// props:
dealerArea: DealerArea;
onDealerPlay: (cards: string[], slots: DealerSlotId[]) => Promise<boolean>;
// widen discard if you add DEALER source later:
// onDiscard: (cards: string[], source: "HAND" | "PLAY" | "DEALER") => ...

const [dealerEmptySelected, setDealerEmptySelected] = useState<DealerSlotId[]>([]);
const [dealerPlaySelected, setDealerPlaySelected] = useState<DealerSlotId[]>([]);

const selectedDealerCards = () =>
  dealerPlaySelected
    .map((s) => (dealerArea ?? {})[s])
    .filter(Boolean) as string[];

const selectDiscard = () => {
  setDiscardSelected(true);
  setDrawSelected(false);
  setEmptySelected([]);
  setDealerEmptySelected([]); // empty dealer ≠ discard
  // keep playSelected + dealerPlaySelected
};

const selectDealerEmpty = (id: DealerSlotId) => {
  setDrawSelected(false);
  setDiscardSelected(false);
  setPlaySelected([]);
  setEmptySelected([]);
  setDealerPlaySelected([]);
  setDealerEmptySelected((prev) =>
    prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
  );
};

const selectDealerOccupied = (id: DealerSlotId) => {
  setDrawSelected(false);
  // keep discardSelected
  setEmptySelected([]);
  setDealerEmptySelected([]);
  setPlaySelected([]); // optional: one play-zone at a time
  setDealerPlaySelected((prev) =>
    prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
  );
};

const handleDealerPlace = async (id: DealerSlotId) => {
  const slots = dealerEmptySelected.includes(id)
    ? dealerEmptySelected
    : [...dealerEmptySelected, id];

  if (selected.length === 0) return;
  if (slots.length !== selected.length) {
    alert(
      `Select ${selected.length} dealer slot(s) to match your ${selected.length} card(s)`,
    );
    return;
  }
  if (slots.some((s) => dealerArea[s])) {
    alert("slot occupied");
    return;
  }

  const ok = await onDealerPlay(selectedCards(), slots);
  if (ok) {
    setSelected([]);
    setPendingCard(null);
    setDealerEmptySelected([]);
  }
};

const handleDiscardActivate = async () => {
  if (!canDiscard || !discardSelected) return;

  if (dealerPlaySelected.length > 0) {
    const ok = await onDiscard(selectedDealerCards(), "DEALER");
    if (ok) {
      setDealerPlaySelected([]);
      setDiscardSelected(false);
    }
    return;
  }

  if (playSelected.length > 0) {
    const ok = await onDiscard(selectedPlayCards(), "PLAY");
    if (ok) {
      setPlaySelected([]);
      setDiscardSelected(false);
    }
    return;
  }

  if (selected.length === 0) return;
  const ok = await onDiscard(selectedCards(), "HAND");
  if (ok) {
    setSelected([]);
    setPendingCard(null);
    setDiscardSelected(false);
  }
};
```

Pass into `GameTable`:

```tsx
dealerArea={dealerArea}
dealerEmptySelected={dealerEmptySelected}
dealerPlaySelected={dealerPlaySelected}
onSelectDealerEmpty={selectDealerEmpty}
onSelectDealerOccupied={selectDealerOccupied}
onDealerPlace={handleDealerPlace}
```

Also clear dealer selection in your turn-leave / `myPlayArea`-style effects.

---

### 7. Local-only stub (until backend exists)

In `page.tsx` for a quick UI check:

```tsx
const [dealerArea, setDealerArea] = useState<DealerArea>({});

const playToDealer = async (cards: string[], slots: DealerSlotId[]) => {
  // still need a real API that removes from hand
  setDealerArea((prev) => {
    const next = { ...prev };
    cards.forEach((c, i) => {
      next[slots[i]] = c;
    });
    return next;
  });
  // also update hand locally / call existing play endpoint later
  return true;
};
```

---

### Still needed for real multiplayer

Backend: Redis `session:{id}:dealerArea`, `playToDealer` / `discardFromDealer`, include `dealerArea` in game-state socket payload, and a lobby **Dealer board On/Off** toggle.

UX note: current place flow is **hand cards → double-click empty dealer slot**. Poker “draw then click slot” can reuse `pendingCard` / selected hand after draw — same `handleDealerPlace`, no separate draw path required for the board itself.

If you want the next paste to be only the Java `DeckService` + controller pieces, say so and I’ll write those next.