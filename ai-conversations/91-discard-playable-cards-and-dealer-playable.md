## me
i havent worked in the functionality for the dealer board. so the way this would work is for poker so in the settings we would have a toggle for yes or no for the dealer board. If yes that means anyone can click draw card and click a slot on the dealer board and that drawed card will appear on the dealer board. played dealer cards can also be discarded. Playable cards being able to be discarded was a function we use to hae with the old board set up so that needs to translate over to the new board

--- 
## Cursor
That maps cleanly onto what you already have — with one big gap: the **dealer board is still cosmetic**, while **discard-from-play for player boards is already mostly wired**.

### What you already have

**Player play + discard-from-play** (the old behavior) already lives on the new table path:

- Select occupied slots on `Plyr1PlayBoard` → `playSelected`
- Select discard pile → double-click activate
- `handleDiscardActivate` calls `onDiscard(..., "PLAY")`, which hits `DeckService.discardCardsFromPlay`

```216:229:frontend/components/SessionScreen.tsx
  const handleDiscardActivate = async () => {
    if (!canDiscard || !discardSelected) return;
    if (playSelected.length > 0) {
      const ok = await onDiscard(selectedPlayCards(), "PLAY");
      if (ok) setPlaySelected([]);
      return;
    }
    // ... hand discard
  };
```

So “playable cards can be discarded” should already translate — as long as you’re selecting **your** play slots and then activating the discard pile. Opponent boards are display-only (no select handlers), which matches “only discard your own played cards.”

**Dealer board today:** static image only — no slot interaction, no shared state.

```244:250:frontend/components/GameTable.tsx
      <div className={`${styles.seat} ${styles.dealer}`}>
        <img
          className={styles.dealerImg}
          src="/board-parts/dealer-boards/dealer-board.svg"
          alt="Dealer board"
```

Assets are ready though: SVG slots `d01`–`d05`, and card art under `/played-card-spots/dealer/d0N/`.

---

### Dealer board as a new setting

Mirror the existing lobby toggles (`playMode`, `discardMode`) with something like:

| Setting | Meaning |
|---------|---------|
| **Dealer board Off** | Board visible or hidden — your call — but no community play |
| **Dealer board On** | Shared community area; anyone can put drawn cards on slots |

Backend shape that fits the current Redis model: a **session-scoped** hash (not per-player), e.g. `session:{id}:dealerArea` with slots `d01`…`d05`. Broadcast it like `playAreas` so everyone sees the same flop/board.

---

### Intended UX (poker community cards)

What you described is different from normal **hand → player play area**:

1. Click/select draw pile → draw  
2. Click an empty dealer slot → that card lands on the dealer board  
3. Select occupied dealer card(s) + discard pile → discard them off the board  

That implies the card may **never stay in a player’s hand** (or only briefly as pending). Today draw always goes **deck → hand** (`drawCard` + `pendingCard`). For poker you’ll want either:

- **A)** draw → pending → place on dealer (remove from hand / never commit to hand), or  
- **B)** a dedicated `drawToDealer(slot)` that skips the hand entirely  

**A** reuses your pending-card UX; **B** is closer to a real dealer burn/deal.

Also decide: when dealer board is on, is this **instead of** or **in addition to** putting cards on personal play boards? Poker usually wants community-only; War/showdown still wants per-player play.

---

### Discard-from-play “translate to new board”

Two layers:

1. **Player play boards** — already on the new `GameTable` path; keep that path working (don’t only leave it on the old SVG `drawDiscardSection`).
2. **Dealer board cards** — new: select `d0N` occupied slots → same discard-pile activate flow, but source is dealer area (new API or `source: "DEALER"`), not `playerId`’s play hash.

Who can discard dealer cards? You said anyone when dealer board is on — that’s closer to `FREE_DISCARD` semantics for the community board, independent of whose turn it is. Worth making explicit in settings.

---

### Suggested build order

1. Settings toggle + Redis `dealerArea` + socket snapshot  
2. `DealerPlayBoard` (same pattern as `Plyr1PlayBoard`, slots `d01`–`d05`, `playedSpotSrc` for `"dealer"`)  
3. Draw → place on dealer  
4. Discard from dealer (and confirm player play→discard still works end-to-end on the new piles)

One product call: when dealer board is **On**, do you still want personal play areas, or hide/disable them for that session? That choice drives how much the place/discard UI branches.

I’m in Ask mode so I can’t implement this here — switch to Agent mode when you want it built, and we can lock the draw-to-dealer vs pending-card flow first.

--- 
## me
previous functionality of what is selectable may have prohibited being able to discard playable cards because both cannot be selected. I need to change thto played slots can be selected at the same time as the discard pile. Empty slots cannot be selected as the same time as the discard pile

--- 
## Cursor
Yes — that’s exactly what’s blocking discard-from-play right now.

### What’s wrong today

Both sides clear each other:

```163:187:frontend/components/SessionScreen.tsx
  const selectDiscard = () => {
    setDiscardSelected(true);
    setDrawSelected(false);
    clearPlayTargets();  // ← wipes playSelected AND emptySelected
  };

  const selectPlayEmpty = (id: SlotId) => {
    setDiscardSelected(false);  // ok to clear discard
    setPlaySelected([]);
    // ...
  };

  const selectPlayOccupied = (id: SlotId) => {
    setDiscardSelected(false);  // ← this is the bug for play→discard
    setEmptySelected([]);
    // ...
  };
```

So you can never have `discardSelected && playSelected.length > 0` at once, but `handleDiscardActivate` requires both for discard-from-play.

### Target rules

| Selection | Discard pile | Empty slots | Occupied slots | Draw pile |
|-----------|--------------|-------------|----------------|-----------|
| Select **discard** | on | clear | **keep** | clear |
| Select **occupied** slot | **keep** | clear | toggle | clear |
| Select **empty** slot | clear | toggle | clear | clear |
| Select **draw** | clear | clear | clear | on |

In code terms:

1. **`selectDiscard`** — only clear `emptySelected` (and draw), **do not** call full `clearPlayTargets()` / do not clear `playSelected`.
2. **`selectPlayOccupied`** — stop calling `setDiscardSelected(false)`; still clear `emptySelected` and draw.
3. **`selectPlayEmpty`** — keep clearing discard (and occupied), as you want.

Optional cleanup: after a successful play discard, also clear `discardSelected` (hand discard already does; play path currently only clears `playSelected`).

That’s a small, localized change in `SessionScreen.tsx` only — switch to Agent mode if you want it applied.
