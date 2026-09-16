## me
for manual 3 am i suppose to see cards in player 2's hand because i dont currently

---
## Cursor
Yes — on a **2-player** table you should see the other person’s cards, but only as **backs**, not face-up.

### What you should see

| Screen | Bottom (`handBot`) | Top (`handTop`) |
|---|---|---|
| **Your** tab | Your face-up cards | Opponent’s **blue backs** |
| **Their** tab | Their face-up cards | **Your** blue backs |

So on Player 1’s screen, Player 2’s hand is the **top** fan of backs — not a second face-up hand.

If `count` is 0, `OpponentHand` returns `null` (nothing rendered).

---

### Fast checks

**1. Restart the backend** after the `handCounts` Java changes. An old process won’t send them.

**2. In DevTools → Network → WS**, find `DECK_INITIALIZED` right after Start. Payload should look like:

```json
"handCounts": {
  "<player1-uuid>": 3,
  "<player2-uuid>": 3
}
```

- Missing `handCounts` → backend not updated / not restarted  
- Both `0` → deal didn’t happen (`cardsPerPlayer` may still be **0**)  
- Present with 3s but no backs → frontend mapping / CSS

**3. Confirm lobby cards-per-player** is &gt; 0 before start (e.g. 3). Default in UI is `0`; that deals empty hands.

**4. Temporary log in `page.tsx` inside `DECK_INITIALIZED`:**

```tsx
console.log("handCounts", event.payload.handCounts);
```

And in `GameTable`’s `countForSeat`:

```tsx
console.log(seat, pid, handCounts?.[pid]);
```

For 2p, `top` should log the other player’s id and a number &gt; 0.

---

### Common mix-up

On **Player 2’s** screen, Player 2’s cards are only at the **bottom** (face-up). The top row is Player 1’s backs — not “my hand up top.”

---

If you paste one `DECK_INITIALIZED` WS payload (or the `console.log` of `handCounts`), we can tell whether it’s backend empty counts vs frontend seat mapping.

---
## me
i reran the backend and now i see 3 cards in the opponents hand

---
## Cursor
That confirms it — the backend needed a restart so `handCounts` was actually on `DECK_INITIALIZED`.

Quick follow-ups when you want them:
- Draw → opponent backs go to 4  
- Play/discard from hand → backs drop  
- Refresh → fans come back from `GAME_STATE`

After that, you’re done with real hand counts.