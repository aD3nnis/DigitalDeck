## me
sweet so now to an earlier point of what are the options for turn discard
---
## Cursor

For **Turn Discard** (only current player discards; with Turn Rotation, discard ends the turn), the main forks are how many cards and when the turn ends.

### 1. How many cards per turn?

| Option | Behavior | Games it fits |
|--------|----------|----------------|
| **Exactly one** | Must select 1; Discard enabled only when `selected.length === 1` | Classic Rummy, Gin (end of turn), Phase 10 |
| **One or more (batch)** | Multi-select → one Discard click → all go out → turn ends once | “Dump several,” casual house rules, your current UI direction |
| **At most N** | Cap (e.g. 3); reject or disable over N | Some variants / balance |

### 2. When does the turn advance?

| Option | Behavior |
|--------|----------|
| **Discard ends turn** (what you have) | Draw keeps turn; successful discard (single or batch) advances once |
| **Optional end** | Discard doesn’t auto-advance; separate “End turn” (more flexible, more UI) |
| **Draw ends turn if no discard** | Unusual; usually avoid |

With multi-select, **one batch = one turn end** is the right default. Don’t advance after each card in the loop.

### 3. Must you discard?

| Option | Behavior |
|--------|----------|
| **Discard required** | Can’t end turn without discarding (need End turn disabled until discard, or only discard advances) — your current model |
| **Discard optional** | Need an explicit End turn when they drew but don’t want to discard |

### 4. Interaction with selection order

Already decided if you keep click order: **last selected = top of pile**. Under Turn Discard that’s still one atomic play: order only affects what’s face-up on top, not whose turn it is.

### Practical recommendation for DigitalDeck

Given select-then-act + last-selected-on-top:

1. **Turn Discard = batch allowed, turn advances once after the whole batch** (needs batch API, or you’re stuck with the “first card advances, rest fail” bug).
2. Optionally later: lobby toggle **“Single discard only”** for Rummy-like rules (`maxDiscardPerTurn: 1`).
3. Keep **draw does not advance** when `TURN_DISCARD` (already true).

So the “options” worth exposing long-term are less new modes and more knobs on Turn Discard:

- `allowMultiDiscard: true | false`  
- (later) `requireDiscardToEndTurn: true` vs explicit End turn  

For now you only need **multi-discard + single turn advance**; single-card-only can wait until a real Rummy preset.

---
## me
How i want it to work is all the cards selected you can discard and that ends your turn only if its on "turn discard" so i think that is option 1

---
## Cursor
You’re describing the right end state — just not “exactly one card.”

**What you want**
- Discard **all** selected cards in one action (batch / “one or more”).
- That action **ends the turn only in Turn Discard** (+ Turn Rotation, which you already gate on).
- Free Discard: same multi-discard, **no** turn advance.
- Discard Off: no discard button.

That’s **batch discard** + **“discard ends turn”** (my earlier table row “One or more”, and turn-advance option “Discard ends turn”) — not the “exactly one” row.

**Today vs needed**
- Policy already: Turn Discard → discard advances turn; Free Discard → doesn’t.
- Gap: looping single `POST /discard` advances after the **first** card. You need one request (or one policy check) that discards the whole list, then advances **once**.

So yes: multi-select dump, one turn end when mode is Turn Discard.

---
## me
so what does the code look like for this change?
---
## Cursor
Here’s the batch discard change end-to-end. Last card in the list = top of pile; turn advances **once** only when `permitDiscard` says so (Turn Discard + Turn Rotation).

### 1. `DiscardRequest.java` — accept a list

```java
package com.ava.digitaldeck.model;

import java.util.List;

public record DiscardRequest(String playerId, List<String> cards) {}
```

(Drop single `card`, or keep both temporarily; prefer `cards` only.)

### 2. `DeckService.java` — discard in order, return what was moved

```java
/** Discards cards in order; last successful card is top of discard. */
public List<String> discardCards(String sessionId, String playerId, List<String> cards) {
    if (cards == null || cards.isEmpty()) return List.of();

    List<String> discarded = new ArrayList<>();
    for (String card : cards) {
        Optional<String> one = discardCard(sessionId, playerId, card);
        if (one.isEmpty()) {
            // stop on first missing card; already-discarded stay discarded
            break;
        }
        discarded.add(one.get());
    }
    return discarded;
}
```

Stricter (all-or-nothing) is nicer later with a transaction; for Redis lists, fail-fast after partial is OK if the API returns an error when `discarded.size() != cards.size()`.

### 3. `SessionController.java` — one permit, one advance

```java
@PostMapping("/{sessionId}/discard")
public ResponseEntity<?> discard(@PathVariable String sessionId, @RequestBody DiscardRequest request) {
    if (!sessionService.sessionExists(sessionId)) {
        return ResponseEntity.notFound().build();
    }

    List<String> cards = request.cards();
    if (cards == null || cards.isEmpty()) {
        return ResponseEntity.badRequest().body(Map.of("error", "no cards"));
    }

    TurnActionPolicy.Permit permit = turnActionPolicy.permitDiscard(sessionId, request.playerId());
    if (permit instanceof TurnActionPolicy.Permit.Denied(String error)) {
        return ResponseEntity.status(403).body(Map.of("error", error));
    }
    boolean advanceTurn = ((TurnActionPolicy.Permit.Allowed) permit).advanceTurnAfter();

    List<String> discarded = deckService.discardCards(sessionId, request.playerId(), cards);
    if (discarded.isEmpty()) {
        return ResponseEntity.badRequest().body(Map.of("error", "card not in hand"));
    }
    if (discarded.size() != cards.size()) {
        // optional: treat as hard failure; topDiscard already updated for partial
        return ResponseEntity.badRequest().body(Map.of(
                "error", "some cards not in hand",
                "discarded", discarded,
                "topDiscard", discarded.get(discarded.size() - 1)
        ));
    }

    String topDiscard = discarded.get(discarded.size() - 1);

    Map<String, Object> payload = new HashMap<>();
    payload.put("playerId", request.playerId());
    payload.put("cards", discarded);
    payload.put("topDiscard", topDiscard);

    messagingTemplate.convertAndSend(
            "/topic/session/" + sessionId,
            new SessionEvent("CARD_DISCARDED", sessionId, payload));

    maybeAdvanceTurn(sessionId, advanceTurn); // once — only true for Turn Discard + Turn Rotation

    return ResponseEntity.ok(Map.of(
            "cards", discarded,
            "topDiscard", topDiscard
    ));
}
```

`TurnActionPolicy.permitDiscard` stays as-is: `advanceTurnAfter` is true only for Turn Rotation + Turn Discard.

### 4. `page.tsx` — one request, order = selection order

```tsx
const discardCards = async (cards: string[]): Promise<boolean> => {
  if (!sessionId || cards.length === 0) return false;

  const res = await fetch(`http://localhost:8080/api/sessions/${sessionId}/discard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, cards }), // last entry = top
  });

  if (!res.ok) {
    const error = await res.json();
    alert(error.error ?? "Could not discard");
    // optional: rehydrateHand(sessionId) if partial discard is possible
    return false;
  }

  const { cards: discarded } = await res.json();
  setHand((prev) => {
    let next = [...prev];
    for (const card of discarded as string[]) {
      const idx = next.indexOf(card);
      if (idx !== -1) next = [...next.slice(0, idx), ...next.slice(idx + 1)];
    }
    return next;
  });
  return true;
};
```

`CARD_DISCARDED` handler can keep using `event.payload.topDiscard` (already set). Optionally also read `cards` if you show a toast later.

### 5. No SessionScreen change for turn logic

Keep sending `selected.map(i => hand[i])` in click order. Last selected → last in `cards` → `topDiscard`.

---

**Behavior summary**

| Mode | Multi-discard | Turn advances? |
|------|---------------|----------------|
| Turn Discard (+ Turn Rotation) | Yes, one POST | Yes, once |
| Free Discard | Yes, one POST | No |
| Discard Off | Blocked by policy | — |

I'm in Ask mode — switch to Agent if you want this applied in the repo.

---