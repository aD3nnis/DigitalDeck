## me
There was previous code also for putting cards on top of the player ones perspective cards. So we want to re-implement that again. Next we will make sure every persons perspective of opponents hands being played looks correct as well. 

---
## Cursor
Yes — same idea as discard: warp art on top of the slot face. For **your** board that code already lives in `Plyr1PlayBoard`; it just isn’t mounted on `GameTable` anymore (bottom seat is still a static `<img>`). Re-wire that first; opponents come next.

---

### What already works

`Plyr1PlayBoard` already overlays warped cards via:

```77:86:frontend/components/Plyr1PlayBoard.tsx
          {card && box && (
            <image
              href={playedSpotSrc("plyr-bottom-center", slot.id, card)}
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              preserveAspectRatio="none"
              pointerEvents="none"
            />
```

`SessionScreen` already has `handlePlace`, `selectedSlot`, `playSelected`, `myPlayArea` — they just aren’t passed into the table.

---

### 1. `GameTable.tsx` — bottom seat = interactive play board

Add imports + props:

```tsx
import Plyr1PlayBoard, { type SlotId } from "./Plyr1PlayBoard";
import type { PlayArea } from "./types";
import sessionStyles from "./SessionScreen.module.css";
```

```tsx
type Props = {
  // ...existing
  myPlayArea?: PlayArea;
  selectedSlot?: SlotId | null;
  playSelected?: SlotId[];
  onSelectEmptySlot?: (id: SlotId) => void;
  onSelectOccupiedSlot?: (id: SlotId) => void;
  onPlace?: (id: SlotId) => void;
};
```

Destructure with defaults, then **replace** `{board("bottom")}` with:

```tsx
<div className={`${styles.seat} ${styles.bottom}`}>
  <span className={styles.playerLabel}>
    {name("bottom", "bottom")} ({seatNumber("bottom")})
  </span>
  <div className={sessionStyles.yourPlayBoard}>
    <Plyr1PlayBoard
      occupied={myPlayArea ?? {}}
      selectedSlot={selectedSlot ?? null}
      playSelected={playSelected ?? []}
      onSelectEmpty={(id) => onSelectEmptySlot?.(id)}
      onSelectOccupied={(id) => onSelectOccupiedSlot?.(id)}
      onPlace={(id) => onPlace?.(id)}
    />
  </div>
</div>
```

`.yourPlayBoard` already has `position: relative` + aspect-ratio so the absolute SVG sizes correctly. Other seats stay static `board(...)` for now.

---

### 2. `SessionScreen.tsx` — wire handlers + pass props

You still need occupied-slot toggle (state exists, handlers don’t):

```tsx
const togglePlaySlot = (id: SlotId) => {
  setPlaySelected((prev) =>
    prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
  );
};
```

On `GameTable`:

```tsx
<GameTable
  // ...existing draw/discard props
  myPlayArea={myPlayArea}
  selectedSlot={selectedSlot}
  playSelected={playSelected}
  onSelectEmptySlot={setSelectedSlot}
  onSelectOccupiedSlot={togglePlaySlot}
  onPlace={handlePlace}
/>
```

Flow again:
1. Select hand card(s)  
2. Click empty slot (sets `selectedSlot`)  
3. Double-click that slot → `handlePlace` → `onPlay` → `playAreas` updates → overlay shows `default_${card}.svg` in that slot  

---

### 3. Shared turn clear (when you do it)

Add to the turn-leave effect:

```tsx
setSelectedSlot(null);
setPlaySelected([]);
```

---

### Next (opponents) — don’t do yet, but the map is:

| Screen seat | Art folder for overlays |
|-------------|-------------------------|
| `bottom` (you) | `plyr-bottom-center` |
| `top` | `plyr-top-center` |
| `left` / `right` | `plyrs-bottom-left-right` (or top variants) |
| `topLeft` / `topRight` | `plyrs-top-left-right` |

Those seats will need view-only overlays of `playAreas[pidAt(seat)]` with the matching `playedSpotSrc` seat key — same swap, no click-to-place.

---

**Order:** mount `Plyr1PlayBoard` on bottom now → confirm your played cards show → then opponent perspectives.

I'm in Ask mode; switch to Agent if you want this applied in the repo.