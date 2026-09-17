## me
i want to do a fix. the current set up we have with clicking and selecting the draw pile needs to be tweaked on turn rotations. When a turn ends and a persons turn ended, nothing should be selected. Keep this in mind for both the discard pile and playing cards. This is a mechanic that only matters on turn rotation not free rotation. I have not implemented selecting for playing cards or the discard pile so i can do that first if it makes more sense

---
## Cursor
**Fix draw-pile clear now; add discard/play selection later and reuse the same clear rule.** You do not need discard/play selection first.

### What you already have

Hand selection already clears when the turn leaves you:

```193:198:frontend/components/SessionScreen.tsx
  useEffect(() => {
    if (currentTurn !== playerId) {
      setSelected([]);
      setPendingCard(null);
    }
  }, [currentTurn, playerId]);
```

Draw-pile selection does **not**. It lives only in `GameTable` as local `drawSelected`, and `GameTable` never sees `currentTurn` / `gameMode`:

```64:64:frontend/components/GameTable.tsx
  const [drawSelected, setDrawSelected] = useState(false);
```

So after a turn-ending discard, `canDraw` becomes false but the draw pile can stay visually selected. That is the bug.

Discard pile on the table is still a plain `<img>` — no select state yet. Play-area selection (`playSelected` / `selectedSlot`) exists in `SessionScreen` but is not cleared on turn change (only when `myPlayArea` changes).

### Recommendation

1. **Do the turn-rotation clear for draw first** — that is the live bug.
2. **When you add discard / play-card select**, put their state next to the other selection state and clear them in the **same** “turn left me” effect. Building select UI first without that clear just recreates the same stale-select problem.

### How to clear (turn rotation only)

Keep free rotation alone: in free mode `canDraw` stays true and turns do not hand off, so you should not force-clear.

Best pattern: one place that clears **all** UI selection when it is no longer your turn under turn rotation:

```ts
// conceptually — in SessionScreen (or wherever selection state lives)
useEffect(() => {
  if (gameMode !== "TURN_ROTATION") return;
  if (currentTurn === playerId) return;
  setSelected([]);
  setPendingCard(null);
  setPlaySelected([]);
  setSelectedSlot(null);
  setDrawSelected(false); // once lifted / controlled
}, [currentTurn, playerId, gameMode]);
```

For the draw pile specifically, either:

- **Lift** `drawSelected` into `SessionScreen` and pass `selected` / `onSelect` / `onDeselect` into `GameTable` (mirrors hand; easiest to clear with the effect above), or  
- Pass `currentTurn` + `viewerId` (or a `clearSelection` signal) into `GameTable` and clear there when `currentTurn !== viewerId`.

Clearing when `canDraw` flips to `false` also works for draw-only, but a shared turn-leave effect scales better once discard/play select exist.

### Order of work

| Step | Why |
|------|-----|
| 1. Clear draw select on turn leave | Fixes current sticky select |
| 2. Add discard pile select (same `BoardAction` / `SelectablePileBoard` pattern) | Wire into same clear |
| 3. Add / harden play-card select clear | Same effect |

So: tweak turn-rotation clear for draw now; implement discard/play select next and hook them into that same clear. I am in Ask mode — switch to Agent mode if you want this applied in the repo.