## me
lets now consolidate initDeck
---
## Cursor
Move the whole start-game use case into a deep service; keep the controller as HTTP in/out. Optionally share the host/lobby gate with `LobbySettingsService` so that policy isn’t duplicated again.

### 1. Shared lobby gate (optional but good)

Add to `LobbySettingsService` (or a tiny `LobbyAccess` helper both call):

```java
/** Host-only actions while still in lobby (game not started). */
public UpdateResult requireHostInLobby(String sessionId, String playerId) {
    if (!sessionService.sessionExists(sessionId)) {
        return new UpdateResult.NotFound();
    }
    var host = sessionService.getHost(sessionId);
    if (host.isEmpty() || !host.get().equals(playerId)) {
        return new UpdateResult.Forbidden("only the host can do this");
    }
    if (sessionService.gameStarted(sessionId)) {
        return new UpdateResult.Conflict("game already started");
    }
    return null; // or use Optional / a Pass record — see note below
}
```

Cleaner with a small sealed type or `Optional<UpdateResult>` where empty means “ok to proceed”. Example:

```java
/** Empty = allowed; present = stop and map to HTTP. */
public Optional<UpdateResult> denyUnlessHostInLobby(String sessionId, String playerId) {
    if (!sessionService.sessionExists(sessionId)) {
        return Optional.of(new UpdateResult.NotFound());
    }
    var host = sessionService.getHost(sessionId);
    if (host.isEmpty() || !host.get().equals(playerId)) {
        return Optional.of(new UpdateResult.Forbidden("only the host can do this"));
    }
    if (sessionService.gameStarted(sessionId)) {
        return Optional.of(new UpdateResult.Conflict("game already started"));
    }
    return Optional.empty();
}
```

Then `updateWhileInLobby` starts with:

```java
Optional<UpdateResult> denied = denyUnlessHostInLobby(sessionId, playerId);
if (denied.isPresent()) return denied.get();
// applyChange + broadcast...
```

And start-game reuses the same gate.

---

### 2. `GameStartService` — deep `initDeck` logic

```java
package com.ava.digitaldeck.services;

import com.ava.digitaldeck.model.GameMode;
import com.ava.digitaldeck.model.SessionEvent;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

@Service
public class GameStartService {

    public sealed interface StartResult {
        record Ok(Object body) implements StartResult {}
        record NotFound() implements StartResult {}
        record Forbidden(String error) implements StartResult {}
        record Conflict(String error) implements StartResult {}
        record BadRequest(Object body) implements StartResult {}
    }

    private final SessionService sessionService;
    private final DeckService deckService;
    private final TurnService turnService;
    private final LobbySettingsService lobbySettingsService;
    private final SimpMessagingTemplate messagingTemplate;

    public GameStartService(SessionService sessionService,
                            DeckService deckService,
                            TurnService turnService,
                            LobbySettingsService lobbySettingsService,
                            SimpMessagingTemplate messagingTemplate) {
        this.sessionService = sessionService;
        this.deckService = deckService;
        this.turnService = turnService;
        this.lobbySettingsService = lobbySettingsService;
        this.messagingTemplate = messagingTemplate;
    }

    public StartResult startGame(String sessionId, String playerId) {
        Optional<LobbySettingsService.UpdateResult> denied =
                lobbySettingsService.denyUnlessHostInLobby(sessionId, playerId);
        if (denied.isPresent()) {
            return switch (denied.get()) {
                case LobbySettingsService.UpdateResult.NotFound() -> new StartResult.NotFound();
                case LobbySettingsService.UpdateResult.Forbidden(String e) -> new StartResult.Forbidden(e);
                case LobbySettingsService.UpdateResult.Conflict(String e) -> new StartResult.Conflict(e);
                case LobbySettingsService.UpdateResult.Ok ignored ->
                        throw new IllegalStateException("deny helper should not return Ok");
            };
        }

        // Friendlier host message for start-game (optional)
        // You can pass a custom forbidden string from denyUnlessHostInLobby instead.

        if (!sessionService.canDealStartingHands(sessionId)) {
            int players = sessionService.getPlayerOrder(sessionId).size();
            int cardsPerPlayer = sessionService.getCardsPerPlayer(sessionId);
            int deckCount = sessionService.getDeckCount(sessionId);
            return new StartResult.BadRequest(Map.of(
                    "error", "not enough cards for starting hands",
                    "players", players,
                    "cardsPerPlayer", cardsPerPlayer,
                    "needed", players * cardsPerPlayer,
                    "available", deckCount * 52
            ));
        }

        int deckCount = sessionService.getDeckCount(sessionId);
        int cardsPerPlayer = sessionService.getCardsPerPlayer(sessionId);
        deckService.initializeDeck(sessionId, deckCount);
        deckService.dealStartingHands(
                sessionId,
                sessionService.getPlayerOrder(sessionId),
                cardsPerPlayer
        );

        GameMode mode = sessionService.getGameMode(sessionId);
        long remaining = deckService.remainingCount(sessionId);

        messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                new SessionEvent("DECK_INITIALIZED", sessionId, Map.of(
                        "remaining", remaining,
                        "gameMode", mode.name(),
                        "cardsPerPlayer", cardsPerPlayer
                )));

        String currentPlayer = null;
        if (mode == GameMode.TURN_ROTATION) {
            turnService.startTurns(sessionId);
            currentPlayer = turnService.getCurrentPlayer(sessionId).orElse(null);
            messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                    new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", currentPlayer)));
        }

        return new StartResult.Ok(Map.of(
                "remaining", remaining,
                "currentTurn", currentPlayer,
                "gameMode", mode.name(),
                "cardsPerPlayer", cardsPerPlayer
        ));
    }
}
```

Note: `Map.of` does not allow `null` values. Your old code put `currentPlayer` which can be `null` in free rotation. Prefer `HashMap` for the response (and event if needed):

```java
Map<String, Object> body = new HashMap<>();
body.put("remaining", remaining);
body.put("currentTurn", currentPlayer); // may be null
body.put("gameMode", mode.name());
body.put("cardsPerPlayer", cardsPerPlayer);
return new StartResult.Ok(body);
```

Same for `TURN_CHANGED` if `playerId` can be null — use a `HashMap` there too.

---

### 3. Thin controller

```java
private final GameStartService gameStartService;

// in constructor: assign gameStartService

private ResponseEntity<?> toStartResponse(GameStartService.StartResult result) {
    return switch (result) {
        case GameStartService.StartResult.NotFound() ->
                ResponseEntity.notFound().build();
        case GameStartService.StartResult.Forbidden(String error) ->
                ResponseEntity.status(403).body(Map.of("error", error));
        case GameStartService.StartResult.Conflict(String error) ->
                ResponseEntity.status(409).body(Map.of("error", error));
        case GameStartService.StartResult.BadRequest(Object body) ->
                ResponseEntity.badRequest().body(body);
        case GameStartService.StartResult.Ok(Object body) ->
                ResponseEntity.ok(body);
    };
}

@PostMapping("/{sessionId}/deck/init")
public ResponseEntity<?> initDeck(@PathVariable String sessionId, @RequestParam String playerId) {
    return toStartResponse(gameStartService.startGame(sessionId, playerId));
}
```

You can tune the forbidden string to `"only the host can start the game"` inside `startGame` if you want the old wording.

---

### What this consolidates

- Host + exists + not-started → shared with lobby settings (if you add `denyUnlessHostInLobby`)
- Deal validation + deck init + deal + events + start turns → one `startGame` module
- Controller → one line

Minimum path if you want less churn: skip the shared gate and put exists/host/started only inside `GameStartService.startGame` (still worth it; lobby PATCHes stay as they are).

I can’t apply this in Ask mode — switch to Agent mode if you want it implemented in the repo.