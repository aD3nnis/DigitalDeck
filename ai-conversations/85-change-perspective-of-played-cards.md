## me
ok i have a problem that i notice for the future. If you see how when people join or leave the game, the board associated with the player changes and that means the perspective changes. The cards in hand are wired to hand that perspective change but the cards played do not. For example, I added a 3rd player and that got rid of the cards in the 2nd players hand from the 1st players perspective because they are now in a difference perspective. So we can either proceed with making the perspectives of players 3-6 look proper and then figure out how it works when people leave and join the game and the rearranges the players in seats and the perspective of their played cards

---
## Cursor
You’ve got the right mental model. The surprising bit is that **join/leave remapping for played cards is mostly already solved in data** — what’s missing is rendering for non-top seats.

## What’s actually happening

Hands and play areas both resolve through the same seat → player map:

```108:115:frontend/components/GameTable.tsx
  const bySeat = screenPlayersBySeat(turnOrderIds, viewerId);
  
  const pidAt = (seat: SeatKey) => bySeat[seat];

  const areaForSeat = (seat: SeatKey): PlayArea => {
    const pid = pidAt(seat);
    return pid ? playAreas?.[pid] ?? {} : {};
  };
```

Hands use that for every opponent seat. Played cards only render in two places:

- **bottom** → `Plyr1PlayBoard` (you)
- **top** → `PlyrTopPlayBoard` (only when the layout has a top board)

Left / right / topLeft / topRight only get the static board SVG from `board()` — no play overlay.

So in your 2→3 example from ply1’s view:

| Count | ply2 screen seat | Played cards shown? |
|------|------------------|---------------------|
| 2P | `top` | Yes (`PlyrTopPlayBoard`) |
| 3P | `left` | No (static board only) |

`playAreas[ply2]` is still there. The cards didn’t get lost — they just have nowhere to draw.

## Recommended order

**Do perspectives for seats 3–6 (and left/right play boards) first.** Then join/leave should mostly fall out.

Reason: once every screen seat can render `areaForSeat(seat)`, join/leave is the same path hands already use — remap seats via `screenPlayersBySeat`, look up by player id. You don’t need a second remapping system for played cards.

Assets already exist for the missing orientations (`plyrs-top-left-right`, `plyrs-bottom-left-right`); they’re just not wired like `plyr-top-center` / `plyr-bottom-center`.

## What “join/leave” still means after that

Not “reattach cards to the right person” (player-id keys already do that), but:

1. **When `n` changes**, `ABSOLUTE` / `RING` change and people hop screen seats (e.g. top → left). With play boards on every seat, cards should follow like hand counts.
2. **Visual orientation** is seat-based (which asset folder / rotation), identity is player-based — keep those separate.
3. **Mid-game join/leave** may also need a product rule (freeze seats during a round vs live rearrange). That’s separate from the render gap.

So: wire play overlays for left/right/(topLeft/topRight) next; treat join/leave as a smoke test of that wiring, not a second big architecture pass.
