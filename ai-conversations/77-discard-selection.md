## me
ok we will want to do one shared clear for turn rotation later so now lets work on selecting for discard. you must select the discard pile and also select a card(s) from your hand and then double click the discard pile. That completes the discard.

---
## Cursor
Put discard select state in `SessionScreen` (so the shared turn-leave clear can own it later), and mirror the draw pile’s `SelectablePileBoard` wiring in `GameTable`. Hand select already works.

### Flow

1. Single-click discard → select pile  
2. Click hand card(s) → select cards  
3. Double-click discard → discard only if **pile selected + ≥1 hand card + `canDiscard`**

`boardInteraction` double-click does **not** leave the pile selected if it wasn’t already — so `onActivate` must require `discardSelected`.

---

### 1. `SessionScreen.tsx` — state + handler

```tsx
const [discardSelected, setDiscardSelected] = useState(false);

const handleDiscardActivate = async () => {
  if (!canDiscard || !discardSelected || selected.length === 0) return;
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
<GameTable
  // ...existing props
  canDraw={canDraw}
  onDraw={handleDrawDblClick}
  canDiscard={canDiscard}
  discardSelected={discardSelected}
  onSelectDiscard={() => setDiscardSelected(true)}
  onDeselectDiscard={() => setDiscardSelected(false)}
  onDiscardActivate={handleDiscardActivate}
/>
```

Optional later for shared clear (not required for this step):

```tsx
useEffect(() => {
  if (gameMode !== "TURN_ROTATION") return;
  if (currentTurn === playerId) return;
  setSelected([]);
  setPendingCard(null);
  setDiscardSelected(false);
  // setDrawSelected(false) once draw is lifted too
}, [currentTurn, playerId, gameMode]);
```

---

### 2. `GameTable.tsx` — props + replace static discard `<img>`

```tsx
type Props = {
  // ...existing
  canDraw?: boolean;
  onDraw?: () => void;
  canDiscard?: boolean;
  discardSelected?: boolean;
  onSelectDiscard?: () => void;
  onDeselectDiscard?: () => void;
  onDiscardActivate?: () => void;
};
```

Destructure with defaults, then:

```tsx
<div className={styles.discard}>
  <SelectablePileBoard
    src="/board-parts/dealer-boards/discard-pile-board.svg"
    label="Discard pile"
    action={{
      canUse: canDiscard,
      selected: discardSelected,
      onSelect: () => onSelectDiscard?.(),
      onDeselect: () => onDeselectDiscard?.(),
      onActivate: () => onDiscardActivate?.(),
    }}
  />
</div>
```

Selected highlight already works — `BoardInteraction.module.css` targets `#discard-board`.

---

### 3. Behavior notes

- **`canUse: canDiscard`** — allow selecting the pile with an empty hand; block activate until cards are selected.  
- **Order doesn’t matter** — pile then cards, or cards then pile.  
- **Ignore the unused `drawDiscardSection`** in `SessionScreen`; table discard goes through `GameTable`.  
- **Play-area discard** — leave out for now unless you want `playSelected` in the same activate path.

Optional UX: selecting draw clears discard (and the reverse) so only one pile is selected.

I'm in Ask mode — switch to Agent mode if you want this applied in the repo.

---
## me
did i implment the code correctly?

--- 
## Cursor
Yes — the discard flow is wired correctly.

**What’s right**
- `discardSelected` lives in `SessionScreen`
- Activate requires `canDiscard` + pile selected + hand cards
- Success clears hand, pending, and discard select
- `GameTable` uses `SelectablePileBoard` with the right props
- Props are passed through correctly

**One cleanup:** you now have two turn-leave effects. The old one:

```203:208:frontend/components/SessionScreen.tsx
  useEffect(() => {
    if (currentTurn !== playerId) {
      setSelected([]);
      setPendingCard(null);
    }
  }, [currentTurn, playerId]);
```

…and the new shared one that also clears `discardSelected`. Drop the old one and keep the new `TURN_ROTATION`-gated effect so you don’t clear twice (and so free rotation isn’t affected by the old effect).

Draw clear via `!canDraw` in `GameTable` is also fine for now.

That’s it — mechanic looks good; just merge the clear effects.

---
## me
Another thing for discarding is I want the cls-1 in the discard pile to then take on the shape of the last card that is being discarded. This was something that was implemented a long time ago in my previous messages in ai-conversations, do you understand what i am referrencing?

--- 
## Cursor
Yes. You’re talking about the discard **card swap** from [Card swap request](e2dcdb2c-4a5d-4703-a25e-1101b8d6809f) — same idea later reused for play-board slots in [Card placement and swapping](af087c7e-8560-4e1d-98ec-dfd32b7a5a1d).

**What it means:** the green face in `#discard-pile` (`cls-1` on `discard-pile-board.svg`) is the empty placeholder. When something is discarded, that face should show the last discarded card as the warped art from:

`/played-card-spots/discard-pile/default_${cardId}.svg`

via `discardPileSrc(topDiscard)` — same card id, discard-pile perspective (not the rectangular hand card).

**How it was done:** not by rewriting the `cls-1` path, but by overlaying that SVG on top of the pile when `topDiscard` is set. That still exists in the unused `drawDiscardSection`:

```284:286:frontend/components/SessionScreen.tsx
          <div className={styles.discardCardBoardContent}>
          {topDiscard && (
            <img src={discardPileSrc(topDiscard)} alt={topDiscard} />
```

**Gap now:** `GameTable`’s discard is only `SelectablePileBoard` (static board SVG), so the swap never shows on the table. You need to pass `topDiscard` into `GameTable` and layer `discardPileSrc(topDiscard)` over the discard pile the same way.

So: last discarded card → warped discard-spot image covering the `cls-1` face. Same mechanic as before; it just isn’t wired on the new table discard yet.