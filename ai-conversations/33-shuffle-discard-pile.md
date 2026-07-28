## me
the next functionality i want to add after having a discard option i want to keep track of the discard pile so that when cards in the draw deck run out you can shuffle the discard pile and reset the draw deck with what was in the discard pile

---
Good news: you’re already tracking the discard pile. Redis has `session:{id}:discard`, discards `rightPush` onto it, and draw returns `"deck is empty"` when the draw list is gone. What’s missing is the **reshuffle path**.

## Design choice (decide this first)

| Approach | Behavior | Feels like |
|---|---|---|
| **Auto on empty draw** | `drawCard` sees empty deck → shuffle discard into deck → draw | Most card games (Rummy, Continental) |
| **Manual reshuffle** | Host/anyone hits “reshuffle discard” when deck is empty | More control, useful for testing |

For DigitalDeck, **auto on empty draw** is the natural next step and matches real games. You can still expose a manual endpoint later.

Second choice: when reshuffling, **do you leave the top discard face-up?**

- **Leave top card** (classic Rummy): reshuffle everything *under* the top card; top stays as the visible discard.
- **Reshuffle everything**: discard pile becomes empty; `topDiscard` becomes `null`.

Leave-top is more game-like if you ever add “draw from discard.” For v1 either is fine; leave-top is slightly better forward-compat.

## Where it belongs

Keep pile movement in `DeckService` (same pattern as draw/discard). Controller just calls it and broadcasts.

Suggested method:

```java
/**
 * Moves discard pile into draw deck (shuffled).
 * Leaves the top discard in place if discard has more than one card.
 * Returns how many cards were moved into the draw deck.
 */
public int reshuffleDiscardIntoDeck(String sessionId) {
    String deckKey = "session:" + sessionId + ":deck";
    String discardKey = "session:" + sessionId + ":discard";

    List<String> discard = redisTemplate.opsForList().range(discardKey, 0, -1);
    if (discard == null || discard.isEmpty()) {
        return 0;
    }

    // Leave top card face-up when possible
    String keepTop = null;
    if (discard.size() > 1) {
        keepTop = discard.remove(discard.size() - 1);
    }

    Collections.shuffle(discard);

    redisTemplate.delete(discardKey);
    if (keepTop != null) {
        redisTemplate.opsForList().rightPush(discardKey, keepTop);
        redisTemplate.expire(discardKey, SESSION_TTL);
    }

    if (!discard.isEmpty()) {
        redisTemplate.opsForList().rightPushAll(deckKey, discard);
        redisTemplate.expire(deckKey, SESSION_TTL);
    }

    return discard.size();
}
```

Wire it into draw so empty deck isn’t a hard stop when discard has cards:

```java
public Optional<String> drawCard(String sessionId, String playerId) {
    String deckKey = "session:" + sessionId + ":deck";
    String card = redisTemplate.opsForList().leftPop(deckKey);

    if (card == null) {
        int moved = reshuffleDiscardIntoDeck(sessionId);
        if (moved == 0) {
            return Optional.empty(); // truly nothing left
        }
        card = redisTemplate.opsForList().leftPop(deckKey);
        if (card == null) {
            return Optional.empty();
        }
    }

    // ... push to hand as today
}
```

Then `SessionController.draw` can stay almost the same: `"deck is empty"` only means **draw + discard are both exhausted** (all cards are in hands).

## Broadcast / UI

When a reshuffle happens mid-draw, clients should learn:

- new `remaining`
- new `topDiscard` (still the kept top, or `null` if you reshuffled everything)

Options:

1. Include a `reshuffled: true` flag on the existing `CARD_DRAWN` payload when reshuffle ran.
2. Or emit a separate `DECK_RESHUFFLED` event before the draw event.

Option 1 is enough for v1. Frontend already shows `topDiscard` and remaining; just update those fields from the draw response / socket payload.

Also show discard **count** optionally (`discardCount`) so players know a reshuffle is possible — not required for the mechanic to work.

## Edge cases to handle

1. **Discard off** — discard pile should stay empty, so reshuffle does nothing; empty deck still errors. Fine.
2. **Only one discard card** — with leave-top, you can’t move anything; draw still fails until someone discards more (or you decide: if deck empty and only 1 discard, reshuffle that one and clear discard).
3. **All cards in hands** — reshuffle returns 0; `"deck is empty"` is correct.
4. **Concurrency** — two players drawing the last card at once: Redis `leftPop` is atomic per call, but “check empty → reshuffle → pop” is not one Redis transaction. For learning-scale sessions this is usually fine; later you could use a Lua script or lock if you care.

Practical leave-top rule when discard size is 1 and deck is empty: **reshuffle that single card into the deck and clear discard**. Otherwise the game soft-locks with one lonely face-up card and an empty draw pile.

## Suggested v1 scope

1. `DeckService.reshuffleDiscardIntoDeck`
2. Call it from `drawCard` when deck pop returns null
3. Include `remaining`, `topDiscard`, and maybe `reshuffled` on draw success
4. UI: no new button required if auto; optionally show “Discard pile reshuffled” when `reshuffled` is true

Defer for later (same as your brainstorm): draw *from* discard, mandatory discard-after-draw, host-only manual reshuffle button.

I’m in Ask mode so I can’t apply this — switch to Agent mode if you want it implemented in the repo.

---
## me
I'd saw auto reshuffle and leave top card are the defaults i want and handle edge cases described. I want to add "Discard pile reshuffled into draw pile" message when reshuffle is true.

can you should me the code needed to implement this

---
## Cursor
Here’s a concrete patch set for **auto reshuffle + leave top**, with the edge cases we discussed, and a shared UI message when reshuffle happens.

---

### 1. `DeckService` — reshuffle + draw

Replace `drawCard` and add reshuffle helpers:

```java
/** Result of a successful draw. */
public record DrawResult(String card, boolean reshuffled) {}

/**
 * Moves discard into draw deck (shuffled), leaving the top discard face-up when possible.
 * If discard has only 1 card and deck is empty, that card is reshuffled into the deck
 * (otherwise the game soft-locks).
 * Returns how many cards were moved into the draw deck.
 */
public int reshuffleDiscardIntoDeck(String sessionId) {
    String deckKey = "session:" + sessionId + ":deck";
    String discardKey = "session:" + sessionId + ":discard";

    List<String> discard = redisTemplate.opsForList().range(discardKey, 0, -1);
    if (discard == null || discard.isEmpty()) {
        return 0;
    }

    String keepTop = null;
    // Leave top only when there is something underneath to reshuffle
    if (discard.size() > 1) {
        keepTop = discard.remove(discard.size() - 1);
    }

    Collections.shuffle(discard);

    redisTemplate.delete(discardKey);
    if (keepTop != null) {
        redisTemplate.opsForList().rightPush(discardKey, keepTop);
        redisTemplate.expire(discardKey, SESSION_TTL);
    }

    if (!discard.isEmpty()) {
        redisTemplate.opsForList().rightPushAll(deckKey, discard);
        redisTemplate.expire(deckKey, SESSION_TTL);
    }

    return discard.size();
}

public Optional<DrawResult> drawCard(String sessionId, String playerId) {
    String deckKey = "session:" + sessionId + ":deck";
    boolean reshuffled = false;

    String card = redisTemplate.opsForList().leftPop(deckKey);
    if (card == null) {
        int moved = reshuffleDiscardIntoDeck(sessionId);
        if (moved == 0) {
            return Optional.empty(); // deck empty AND discard empty/unusable
        }
        reshuffled = true;
        card = redisTemplate.opsForList().leftPop(deckKey);
        if (card == null) {
            return Optional.empty();
        }
    }

    String handKey = "session:" + sessionId + ":hands:" + playerId;
    redisTemplate.opsForList().rightPush(handKey, card);
    redisTemplate.expire(handKey, SESSION_TTL);

    return Optional.of(new DrawResult(card, reshuffled));
}
```

Keep `getTopDiscard` / `remainingCount` as they are.

**Edge-case behavior this encodes:**

| Situation | Result |
|---|---|
| Deck empty, discard has 2+ cards | Shuffle all but top → deck; top stays; draw proceeds; `reshuffled=true` |
| Deck empty, discard has 1 card | That card becomes the new deck; discard clears; draw proceeds; `reshuffled=true` |
| Deck empty, discard empty | `Optional.empty()` → `"deck is empty"` |
| Discard off (pile never used) | Same as empty discard |

---

### 2. `SessionController.draw` — include `reshuffled` + `topDiscard`

```java
@PostMapping("/{sessionId}/draw")
public ResponseEntity<?> draw(@PathVariable String sessionId, @RequestBody DrawRequest request) {
    if (!sessionService.sessionExists(sessionId)) return ResponseEntity.notFound().build();

    GameMode mode = sessionService.getGameMode(sessionId);
    DiscardMode discardMode = sessionService.getDiscardMode(sessionId);

    if (mode == GameMode.TURN_ROTATION) {
        Optional<String> currentPlayer = turnService.getCurrentPlayer(sessionId);
        if (currentPlayer.isEmpty() || !currentPlayer.get().equals(request.playerId())) {
            return ResponseEntity.status(403).body(Map.of("error", "not your turn"));
        }
    }

    Optional<DeckService.DrawResult> drawn = deckService.drawCard(sessionId, request.playerId());
    if (drawn.isEmpty()) {
        return ResponseEntity.badRequest().body(Map.of("error", "deck is empty"));
    }

    DeckService.DrawResult result = drawn.get();
    String topDiscard = deckService.getTopDiscard(sessionId).orElse(null);

    Map<String, Object> payload = new HashMap<>();
    payload.put("playerId", request.playerId());
    payload.put("remaining", deckService.remainingCount(sessionId));
    payload.put("reshuffled", result.reshuffled());
    payload.put("topDiscard", topDiscard);

    messagingTemplate.convertAndSend(
            "/topic/session/" + sessionId,
            new SessionEvent("CARD_DRAWN", sessionId, payload));

    boolean advanceOnDraw =
            mode == GameMode.TURN_ROTATION && discardMode != DiscardMode.TURN_DISCARD;

    if (advanceOnDraw) {
        String nextPlayer = turnService.advanceTurn(sessionId).orElse(null);
        messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", nextPlayer)));
    }

    return ResponseEntity.ok(Map.of(
            "card", result.card(),
            "reshuffled", result.reshuffled(),
            "remaining", deckService.remainingCount(sessionId),
            "topDiscard", topDiscard
    ));
}
```

You’ll need `import java.util.HashMap;` if it isn’t already there.

Broadcasting `reshuffled` on `CARD_DRAWN` lets **every** player see the message, not only the person who drew.

---

### 3. Frontend — show the message

**`page.tsx`** — add status state and handle `CARD_DRAWN`:

```tsx
const [statusMessage, setStatusMessage] = useState<string | null>(null);
```

In the subscribe handler:

```tsx
} else if (event.type === "CARD_DRAWN") {
  setRemaining(event.payload.remaining);
  if (event.payload.topDiscard !== undefined) {
    setTopDiscard(event.payload.topDiscard ?? null);
  }
  if (event.payload.reshuffled) {
    setStatusMessage("Discard pile reshuffled into draw pile");
  }
}
```

Clear it on leave (with your other resets):

```tsx
setStatusMessage(null);
```

Pass it into `SessionScreen`:

```tsx
statusMessage={statusMessage}
```

**`SessionScreen.tsx`** — fix the discard display (it’s currently broken / stuck inside `canDiscard`) and show the message:

```tsx
type Props = {
  // ...existing props...
  statusMessage: string | null;
};

export default function SessionScreen({
  // ...existing props...
  statusMessage,
}: Props) {
  const canDraw =
    gameMode === "FREE_ROTATION" || currentTurn === playerId;
  const canDiscard =
    discardMode === "FREE_DISCARD" ||
    (discardMode === "TURN_DISCARD" && currentTurn === playerId);

  return (
    <main>
      {/* ...players, turn, draw button... */}

      <p>Cards remaining: {remaining}</p>

      {discardMode !== "DISCARD_OFF" && (
        <p>Discard pile: {topDiscard ?? "(empty)"}</p>
      )}

      {statusMessage && <p>{statusMessage}</p>}

      {/* ...hand, leave... */}
    </main>
  );
}
```

Optional polish: auto-clear the message after a few seconds with a `useEffect` in `page.tsx` — not required for v1.

---

### Flow summary

```text
draw → leftPop deck
  ├─ got card → hand (reshuffled=false)
  └─ null → reshuffleDiscardIntoDeck
        ├─ 0 moved → "deck is empty"
        └─ N moved → leftPop again → hand (reshuffled=true)
              → CARD_DRAWN { remaining, topDiscard, reshuffled: true }
              → UI: "Discard pile reshuffled into draw pile"
```

I’m in Ask mode so this is guidance only — switch to Agent mode if you want it applied in the repo.

---
## me
add the auto clear after 4 seconds
--- 
## Cursor
I'm in Ask mode, so here's the snippet to add — switch to Agent mode if you want it applied for you.

In `page.tsx`, after the `statusMessage` state:

```tsx
const [statusMessage, setStatusMessage] = useState<string | null>(null);

useEffect(() => {
  if (!statusMessage) return;
  const id = setTimeout(() => setStatusMessage(null), 4000);
  return () => clearTimeout(id);
}, [statusMessage]);
```

When a new reshuffle sets the same message again, the effect re-runs, clears the old timer, and starts a fresh 4s window — which is what you want.
---
## me
Request URL
http://localhost:8080/api/sessions/621491df-91ad-46ac-9b68-2f302a4e61b9/draw
Request Method
POST
Status Code
500 Internal Server Error
Remote Address
[::1]:8080
Referrer Policy
strict-origin-when-cross-origin

can you check my code updates

---
## Cursor
The 500 is from this return in `SessionController.draw`:

```141:146:backend/src/main/java/com/ava/digitaldeck/controllers/SessionController.java
        return ResponseEntity.ok(Map.of(
                "card", result.card(),
                "reshuffled", result.reshuffled(),
                "remaining", deckService.remainingCount(sessionId),
                "topDiscard", topDiscard
        ));
```

`Map.of(...)` **does not allow null values**. On a normal draw the discard pile is usually empty, so `topDiscard` is `null` → NPE → 500. The backend log points exactly at line 141.

Your WS payload already uses `HashMap`, which is fine. Reuse that pattern for the HTTP response:

```java
Map<String, Object> body = new HashMap<>();
body.put("card", result.card());
body.put("reshuffled", result.reshuffled());
body.put("remaining", deckService.remainingCount(sessionId));
body.put("topDiscard", topDiscard);
return ResponseEntity.ok(body);
```

Or omit `topDiscard` from the HTTP body when null — the socket event already carries it for clients.

**Everything else looks good:** `DeckService` reshuffle/draw, leave-top + single-card edge case, frontend status message + 4s clear, SessionScreen discard display.

Restart/reload the backend after that change and draw should return 200 again.
