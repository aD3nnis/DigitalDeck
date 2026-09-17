## me
before we do opponents boards i want to think about how we do the selection and what is selected when. Here is how i want it to work if discard is selected, nothing else can be, if draw is selected, nothing else can be, if a play slot is selected, other play slots can be selected but not discard or draw. I also need to figure out what to do if the slots selected do not match the number of cards selected to play

---
 ## Cursor
 Here’s a clean model that matches what you described, plus a concrete answer for the card/slot count mismatch.

### Selection layers

Treat these as two layers:

| Layer | What | Rule |
|--------|------|------|
| **Source** | Hand cards (`selected`) | Can stay selected while a target is chosen |
| **Target** | Draw **xor** Discard **xor** Play slots | Only one target family at a time |

So: picking discard clears draw + all play-slot selection; picking draw clears discard + play slots; picking any play slot clears draw + discard, but other play slots can stay/add.

Hand is not cleared by target switches (you still need cards for discard/play). Clear hand only on successful action or turn leave.

---

### Play slots: empty vs occupied

You currently have two different meanings:

- **Empty** (`selectedSlot`) → where to **place** from hand  
- **Occupied** (`playSelected`) → what to **discard from play**

Don’t mix them in one multi-select. Within “play”:

- Click empty → clear `playSelected`; set/update empty selection  
- Click occupied → clear empty selection; toggle in `playSelected`

That keeps place and discard-from-play from fighting.

---

### How to implement exclusivity

One small helper (once draw is lifted, or call into GameTable):

```ts
function selectDraw() {
  setDrawSelected(true);
  setDiscardSelected(false);
  setSelectedSlot(null);
  setPlaySelected([]);
}

function selectDiscard() {
  setDiscardSelected(true);
  setDrawSelected(false);
  setSelectedSlot(null);
  setPlaySelected([]);
}

function selectPlayEmpty(id: SlotId) {
  setDrawSelected(false);
  setDiscardSelected(false);
  setPlaySelected([]);
  setSelectedSlot(id); // or toggle if you allow deselect
}

function selectPlayOccupied(id: SlotId) {
  setDrawSelected(false);
  setDiscardSelected(false);
  setSelectedSlot(null);
  togglePlaySlot(id);
}
```

---

### Card count vs slot count (place)

You have two possible place models:

**A — Start slot + N hand cards (what you have now)**  
Double-click / activate one empty start slot → place `selected.length` cards in a contiguous run (`runFrom`).  
Empty multi-select is **not** required. Count mismatch with “slots selected” doesn’t apply; only “enough free slots from start” matters (already handled).

**B — Explicit multi empty slots**  
Select N empty slots **and** N hand cards; activate only if counts match and slots form a valid run.

**Recommendation:** stay on **A** for v1. It’s already wired, matches “pick start, lay N left-to-right,” and avoids the mismatch problem for empty slots.

Then mismatch rules are simple:

| Situation | Behavior |
|-----------|----------|
| Place, 0 hand cards | No-op |
| Place, N cards, not enough free slots from start | Refuse (alert / later “jerk”) |
| Discard pile selected, 0 hand (and 0 playSelected) | No-op |
| Discard from play, `playSelected.length ≥ 1` | Discard those; hand count irrelevant |
| Occupied slots selected + hand cards also selected | Prefer **playSelected** as source when activating discard (you already do this) |

If you later want **B**, enforce on activate:

```ts
if (emptySelected.length !== selected.length) return; // or jerk
// also: must be contiguous in SLOT_IDS order
```

---

### Activate cheatsheet

| Target selected | Double-click means | Needs |
|-----------------|--------------------|--------|
| Draw | Draw | — |
| Discard | Discard | hand cards **or** occupied play slots |
| Empty play slot(s) | Place | hand cards; (A) start slot + run, or (B) count match |
| Occupied play only | (optional) discard from play via discard pile, not via slot dbl-click unless you add that |

---

### Decision to lock before coding

1. **Targets exclusive** as you said — yes.  
2. **Hand independent** — yes.  
3. **Place model A or B?** — I’d lock **A** now; revisit B if selecting every destination slot feels important.  
4. **Empty vs occupied** mutually clear each other — yes.

If you confirm A vs B for place, the exclusivity helpers above are the next code to add (before opponent boards).

---
## me
lets keep the option a that we currently have implemented but show me the code for the small helper and also what you mean by (once draw is lifted) are you asking my to delete code?

---
## Cursor
**“Lift” ≠ delete.** It means **move** `drawSelected` from inside `GameTable` up to `SessionScreen`, same place as `discardSelected` / play slots — so one helper can clear all targets. Draw still works; only ownership of the state changes.

---

### Helpers in `SessionScreen` (keep place model A)

```tsx
const [drawSelected, setDrawSelected] = useState(false);

const clearPlayTargets = () => {
  setSelectedSlot(null);
  setPlaySelected([]);
};

const selectDraw = () => {
  setDrawSelected(true);
  setDiscardSelected(false);
  clearPlayTargets();
};

const deselectDraw = () => setDrawSelected(false);

const selectDiscard = () => {
  setDiscardSelected(true);
  setDrawSelected(false);
  clearPlayTargets();
};

const deselectDiscard = () => setDiscardSelected(false);

const selectPlayEmpty = (id: SlotId) => {
  setDrawSelected(false);
  setDiscardSelected(false);
  setPlaySelected([]);
  setSelectedSlot(id); // A: one start slot
};

const selectPlayOccupied = (id: SlotId) => {
  setDrawSelected(false);
  setDiscardSelected(false);
  setSelectedSlot(null);
  setPlaySelected((prev) =>
    prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
  );
};
```

Wire `GameTable` like discard (controlled draw):

```tsx
<GameTable
  // draw — controlled, not local state
  canDraw={canDraw}
  drawSelected={drawSelected}
  onSelectDraw={selectDraw}
  onDeselectDraw={deselectDraw}
  onDraw={handleDrawDblClick}

  canDiscard={canDiscard}
  discardSelected={discardSelected}
  onSelectDiscard={selectDiscard}
  onDeselectDiscard={deselectDiscard}
  onDiscardActivate={handleDiscardActivate}

  onSelectEmptySlot={selectPlayEmpty}
  onSelectOccupiedSlot={selectPlayOccupied}
  onPlace={handlePlace}
  // ...rest unchanged
/>
```

Turn-leave clear can then include:

```tsx
setDrawSelected(false);
setDiscardSelected(false);
clearPlayTargets();
```

---

### `GameTable` — what changes for draw

**Remove** local:

```tsx
const [drawSelected, setDrawSelected] = useState(false);
useEffect(() => { if (!canDraw) setDrawSelected(false); }, [canDraw]);
```

**Add** props (same pattern as discard):

```tsx
drawSelected?: boolean;
onSelectDraw?: () => void;
onDeselectDraw?: () => void;
```

```tsx
action={{
  canUse: canDraw,
  selected: drawSelected,
  onSelect: () => onSelectDraw?.(),
  onDeselect: () => onDeselectDraw?.(),
  onActivate: () => onDraw?.(),
}}
```

Optional: keep a tiny effect that only calls `onDeselectDraw` when `!canDraw`, **or** clear `drawSelected` in SessionScreen’s turn-leave effect (preferred once state lives there).

---

### You do **not** need to delete

| Keep | Move / replace |
|------|----------------|
| Draw pile UI, double-click draw, `canDraw` | `useState` for `drawSelected` → SessionScreen |
| `SelectablePileBoard` wiring | Local `onSelect: () => setDrawSelected(true)` → parent helpers |

So: one home for all target selection → helpers can enforce exclusivity. That’s all “lift” means.

---
## me
did i implement the above code correctly? currently when testing i am not able to select mutiple play slots.