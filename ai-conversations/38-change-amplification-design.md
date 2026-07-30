## me
can we get the code changes for this fix as well: the separate amplification in draw/discard turn checks. That’s the same kind of problem (repeated “may this player act / does turn advance?”), but it needs its own deep module (turn/action policy), not the lobby-settings one.

---
## Cursor
Here’s a matching deep module for **draw/discard turn policy**, plus how `SessionController` would use it. Ask-mode guidance only.

### Current rules (captured in one place)

From your controllers today:

| Action | Allowed when | Advance turn when |
|---|---|---|
| **Draw** | If `TURN_ROTATION` → must be current player; else anyone | `TURN_ROTATION` **and** discard mode is **not** `TURN_DISCARD` |
| **Discard** | Not `DISCARD_OFF`; if `TURN_DISCARD` → must be current player | `TURN_ROTATION` **and** `TURN_DISCARD` |

---

### 1. `TurnActionPolicy` — deep module

```java
package com.ava.digitaldeck.services;

import com.ava.digitaldeck.model.DiscardMode;
import com.ava.digitaldeck.model.GameMode;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class TurnActionPolicy {

    public sealed interface Permit {
        record Allowed(boolean advanceTurnAfter) implements Permit {}
        record Denied(String error) implements Permit {}
    }

    private final SessionService sessionService;
    private final TurnService turnService;

    public TurnActionPolicy(SessionService sessionService, TurnService turnService) {
        this.sessionService = sessionService;
        this.turnService = turnService;
    }

    /** May this player draw? Also answers whether draw should advance the turn. */
    public Permit permitDraw(String sessionId, String playerId) {
        GameMode mode = sessionService.getGameMode(sessionId);
        DiscardMode discardMode = sessionService.getDiscardMode(sessionId);

        if (mode == GameMode.TURN_ROTATION && !isCurrentPlayer(sessionId, playerId)) {
            return new Permit.Denied("not your turn");
        }

        boolean advance =
                mode == GameMode.TURN_ROTATION
                        && discardMode != DiscardMode.TURN_DISCARD;

        return new Permit.Allowed(advance);
    }

    /** May this player discard? Also answers whether discard should advance the turn. */
    public Permit permitDiscard(String sessionId, String playerId) {
        DiscardMode discardMode = sessionService.getDiscardMode(sessionId);
        if (discardMode == DiscardMode.DISCARD_OFF) {
            return new Permit.Denied("discard is disabled");
        }

        if (discardMode == DiscardMode.TURN_DISCARD
                && !isCurrentPlayer(sessionId, playerId)) {
            return new Permit.Denied("not your turn");
        }

        GameMode mode = sessionService.getGameMode(sessionId);
        boolean advance =
                mode == GameMode.TURN_ROTATION
                        && discardMode == DiscardMode.TURN_DISCARD;

        return new Permit.Allowed(advance);
    }

    private boolean isCurrentPlayer(String sessionId, String playerId) {
        Optional<String> current = turnService.getCurrentPlayer(sessionId);
        return current.isPresent() && current.get().equals(playerId);
    }
}
```

---

### 2. Small helper to advance + broadcast (optional but removes more duplication)

You can keep this on the controller or a tiny collaborator:

```java
private void maybeAdvanceTurn(String sessionId, boolean advance) {
    if (!advance) return;
    String nextPlayer = turnService.advanceTurn(sessionId).orElse(null);
    messagingTemplate.convertAndSend(
            "/topic/session/" + sessionId,
            new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", nextPlayer)));
}
```

---

### 3. Slimmer `draw` / `discard` in `SessionController`

Inject `TurnActionPolicy turnActionPolicy` in the constructor.

```java
@PostMapping("/{sessionId}/draw")
public ResponseEntity<?> draw(@PathVariable String sessionId, @RequestBody DrawRequest request) {
    if (!sessionService.sessionExists(sessionId)) {
        return ResponseEntity.notFound().build();
    }

    TurnActionPolicy.Permit permit = turnActionPolicy.permitDraw(sessionId, request.playerId());
    if (permit instanceof TurnActionPolicy.Permit.Denied(String error)) {
        return ResponseEntity.status(403).body(Map.of("error", error));
    }
    boolean advanceTurn = ((TurnActionPolicy.Permit.Allowed) permit).advanceTurnAfter();

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

    maybeAdvanceTurn(sessionId, advanceTurn);

    Map<String, Object> body = new HashMap<>();
    body.put("card", result.card());
    body.put("reshuffled", result.reshuffled());
    body.put("remaining", deckService.remainingCount(sessionId));
    body.put("topDiscard", topDiscard);
    return ResponseEntity.ok(body);
}

@PostMapping("/{sessionId}/discard")
public ResponseEntity<?> discard(@PathVariable String sessionId, @RequestBody DiscardRequest request) {
    if (!sessionService.sessionExists(sessionId)) {
        return ResponseEntity.notFound().build();
    }

    TurnActionPolicy.Permit permit = turnActionPolicy.permitDiscard(sessionId, request.playerId());
    if (permit instanceof TurnActionPolicy.Permit.Denied(String error)) {
        return ResponseEntity.status(403).body(Map.of("error", error));
    }
    boolean advanceTurn = ((TurnActionPolicy.Permit.Allowed) permit).advanceTurnAfter();

    Optional<String> discarded = deckService.discardCard(sessionId, request.playerId(), request.card());
    if (discarded.isEmpty()) {
        return ResponseEntity.badRequest().body(Map.of("error", "card not in hand"));
    }

    Map<String, Object> payload = new HashMap<>();
    payload.put("playerId", request.playerId());
    payload.put("card", discarded.get());
    payload.put("topDiscard", discarded.get());

    messagingTemplate.convertAndSend(
            "/topic/session/" + sessionId,
            new SessionEvent("CARD_DISCARDED", sessionId, payload));

    maybeAdvanceTurn(sessionId, advanceTurn);

    return ResponseEntity.ok(Map.of(
            "card", discarded.get(),
            "topDiscard", discarded.get()
    ));
}
```

Cleaner pattern-matching style if you prefer:

```java
return switch (turnActionPolicy.permitDraw(sessionId, request.playerId())) {
    case TurnActionPolicy.Permit.Denied(String error) ->
            ResponseEntity.status(403).body(Map.of("error", error));
    case TurnActionPolicy.Permit.Allowed(boolean advanceTurn) -> {
        // ... draw, broadcast, maybeAdvanceTurn(sessionId, advanceTurn), yield ok
    }
};
```

---

### Why this fixes that amplification

- “Must be current player?” and “does this action end the turn?” live in **one** policy module.
- Changing rules (e.g. free-rotation still advances somehow, or discard always requires turn) is **one edit** in `TurnActionPolicy`, not both endpoints.
- Controllers keep HTTP + deck I/O + events; they no longer encode the mode matrix.

Together with `LobbySettingsService`, you’d have two deep modules for the two separate amplification sites. I can’t apply this in Ask mode — switch to Agent mode if you want both wired into the repo.