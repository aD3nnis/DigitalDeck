## me
I want to add more functionality. I want players to be able to discard on a discard pile (seperate from where they draw from). I want there to be multiple types simolar to turn rotation and free rotation where it is turn discard or free discard meaning they can discard cards whenever for they have to wait till there turn to discard. A general question i have is based off known card games. I know there are games where you just discard (war) games where you pick up a card and discard (Continental) and games where you don't discard on your turn sometimes (poker). How should i organize this? what should be the game options for discarding in the beginning?

---
## Cursor
Your instinct to mirror turn vs free is right — but treat discard as its own setting, not another value on `GameMode`.

## How real games actually differ

The games you named don’t mainly differ on “can I discard anytime?” They differ on **whether discard exists**, and **what ends a turn**:

| Pattern | Examples | What happens |
|---|---|---|
| No discard pile | Hold’em, War (as play) | Cards leave hand by other rules (bets, tricks), not “discard” |
| Draw then discard (same turn) | Continental, Rummy, Gin | On your turn: draw → discard → turn ends |
| Discard as a special phase | 5-card draw poker | Discard/redraw is its own step, not every turn forever |
| Free discard | casual / house rules | Anyone can dump cards whenever |

So War/poker aren’t really “free discard” — they’re closer to **discard off**. Continental isn’t just “turn discard” — it’s **turn discard that ends the turn after a draw**.

## How to organize it

Keep settings as **independent levers**, which matches what you already said in the game-modes work: defaults + setup before play.

Today `GameMode` is really **draw timing**:

- `TURN_ROTATION` / `FREE_ROTATION`

Add a second setting for **discard timing**:

- `DISCARD_OFF` — no discard pile / no discard action (poker/War-ish for now)
- `TURN_DISCARD` — only current player can discard
- `FREE_DISCARD` — anyone can discard anytime

Store them separately in Redis, same pattern as `gameMode`:

```text
session:{id}:gameMode      → TURN_ROTATION | FREE_ROTATION
session:{id}:discardMode   → DISCARD_OFF | TURN_DISCARD | FREE_DISCARD
session:{id}:discard       → list (top = most recent discard)
```

Don’t invent one mega-enum like `TURN_DRAW_FREE_DISCARD`. Combinations explode, and your lobby UI gets worse.

Valid combos people will actually use:

| Draw | Discard | Feels like |
|---|---|---|
| Turn | Turn | Continental / Rummy-ish skeleton |
| Turn | Off | “Take turns drawing only” (what you have now + no discard) |
| Free | Free | Casual free-for-all |
| Free | Off | Shared deck, no discard |
| Turn | Free | Unusual; allow it, don’t promote it |

## Starting options (v1)

Ship only these three discard choices at create/lobby:

1. **Off** (default if you want current behavior unchanged)
2. **Turn discard**
3. **Free discard**

That’s enough. Don’t start with “must discard after draw,” “can draw from discard,” “max discard count,” or poker discard phases yet.

### One decision you should make now

Right now turn advances on **draw**. For Continental-style turn discard, turn should usually advance on **discard**, not draw.

Practical rule for v1:

- If `discardMode == TURN_DISCARD` and `gameMode == TURN_ROTATION`:  
  draw does **not** advance turn; discard does.
- If discard is `OFF` or `FREE`: keep today’s behavior (draw advances turn in turn mode).

That one rule gets you most of the Continental feel without building a full “turn phases” state machine yet.

## What to leave for later

- **Draw from discard pile** (classic Rummy/Continental)
- **Mandatory discard after draw**
- **Face-up vs face-down discard**
- **Reshuffle discard into deck when draw pile empties**
- Named presets (“Continental”, “Poker”) that fill several settings at once

Presets are a UI convenience on top of settings, not a replacement for them.

## Mental model

Think: **piles + permissions**, not named games.

- Piles: draw deck (exists), discard pile (optional)
- Permissions: who may draw, who may discard
- Turn clock: what action ends the turn (draw vs discard)

That stays aligned with your architecture: `DeckService` owns card movement, controllers branch on session settings, UI only shows discard when `discardMode != OFF`.

If you want a concrete next step in Agent mode, the smallest useful slice is: Redis discard list + `discardMode` setting + discard endpoint that mirrors draw’s turn/free gating.

---
## me
lets implement your V1, give me the code changes you would suggest

---
## Cursor
Here's a concrete V1 patch set that matches your current files. Switch to Agent mode if you want these applied for you.

---

### 1. New enum — `DiscardMode.java`

```java
package com.ava.digitaldeck.model;

public enum DiscardMode {
    DISCARD_OFF,
    TURN_DISCARD,
    FREE_DISCARD;

    public static DiscardMode from(String value) {
        if (value == null || value.isBlank()) {
            return DISCARD_OFF; // default: current behavior
        }
        return DiscardMode.valueOf(value.trim().toUpperCase());
    }
}
```

### 2. New request — `DiscardRequest.java`

```java
package com.ava.digitaldeck.model;

public record DiscardRequest(String playerId, String card) {}
```

### 3. New request — `UpdateDiscardModeRequest.java`

```java
package com.ava.digitaldeck.model;

public record UpdateDiscardModeRequest(String discardMode, String playerId) {}
```

### 4. Update `CreateSessionRequest.java`

```java
package com.ava.digitaldeck.model;

public record CreateSessionRequest(String gameMode, String discardMode) {}
```

---

### 5. `DeckService` — discard pile + remove from hand

Add these methods (and clear discard on init):

```java
public void initializeDeck(String sessionId) {
    List<String> cards = new ArrayList<>();
    for (String suit : SUITS) {
        for (String rank : RANKS) {
            cards.add(rank + suit);
        }
    }
    Collections.shuffle(cards);

    String deckKey = "session:" + sessionId + ":deck";
    String discardKey = "session:" + sessionId + ":discard";

    redisTemplate.delete(deckKey);
    redisTemplate.delete(discardKey);
    redisTemplate.opsForList().rightPushAll(deckKey, cards);
    redisTemplate.expire(deckKey, SESSION_TTL);
}

/** Moves card from hand → discard pile. Empty if card not in hand. */
public Optional<String> discardCard(String sessionId, String playerId, String card) {
    if (card == null || card.isBlank()) return Optional.empty();

    String handKey = "session:" + sessionId + ":hands:" + playerId;
    Long removed = redisTemplate.opsForList().remove(handKey, 1, card);
    if (removed == null || removed == 0) {
        return Optional.empty();
    }

    String discardKey = "session:" + sessionId + ":discard";
    redisTemplate.opsForList().rightPush(discardKey, card);
    redisTemplate.expire(discardKey, SESSION_TTL);
    redisTemplate.expire(handKey, SESSION_TTL);

    return Optional.of(card);
}

/** Top of discard = most recently discarded (rightmost). */
public Optional<String> getTopDiscard(String sessionId) {
    String discardKey = "session:" + sessionId + ":discard";
    Long size = redisTemplate.opsForList().size(discardKey);
    if (size == null || size == 0) return Optional.empty();
    return Optional.ofNullable(redisTemplate.opsForList().index(discardKey, -1));
}
```

---

### 6. `SessionService` — store / read discard mode

```java
import com.ava.digitaldeck.model.DiscardMode;

public String createSession(GameMode gameMode, DiscardMode discardMode) {
    String sessionId = UUID.randomUUID().toString();
    String code = generateUniqueCode();

    redisTemplate.opsForValue().set("code:" + code, sessionId, SESSION_TTL);
    redisTemplate.opsForValue().set("session:" + sessionId + ":meta", "active", SESSION_TTL);
    redisTemplate.opsForValue().set(
            "session:" + sessionId + ":gameMode",
            gameMode.name(),
            SESSION_TTL
    );
    redisTemplate.opsForValue().set(
            "session:" + sessionId + ":discardMode",
            discardMode.name(),
            SESSION_TTL
    );

    return code;
}

public DiscardMode getDiscardMode(String sessionId) {
    String raw = redisTemplate.opsForValue().get("session:" + sessionId + ":discardMode");
    return DiscardMode.from(raw);
}

public void setDiscardMode(String sessionId, DiscardMode discardMode) {
    redisTemplate.opsForValue().set(
            "session:" + sessionId + ":discardMode",
            discardMode.name(),
            SESSION_TTL
    );
}
```

---

### 7. `SessionController` — create, draw turn rule, discard, patch mode

Imports to add:

```java
import com.ava.digitaldeck.model.DiscardMode;
import com.ava.digitaldeck.model.DiscardRequest;
import com.ava.digitaldeck.model.UpdateDiscardModeRequest;

import java.util.HashMap;
```

**Create:**

```java
@PostMapping
public Map<String, String> createSession(@RequestBody(required = false) CreateSessionRequest request) {
    GameMode mode = GameMode.from(request == null ? null : request.gameMode());
    DiscardMode discardMode = DiscardMode.from(request == null ? null : request.discardMode());
    String code = sessionService.createSession(mode, discardMode);
    return Map.of(
            "code", code,
            "gameMode", mode.name(),
            "discardMode", discardMode.name()
    );
}
```

**Draw — only advance turn when discard is not turn-gated:**

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

    Optional<String> card = deckService.drawCard(sessionId, request.playerId());
    if (card.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "deck is empty"));

    messagingTemplate.convertAndSend("/topic/session/" + sessionId,
            new SessionEvent("CARD_DRAWN", sessionId, Map.of(
                    "playerId", request.playerId(),
                    "remaining", deckService.remainingCount(sessionId)
            )));

    // Continental-style: turn ends on discard, not draw
    boolean advanceOnDraw =
            mode == GameMode.TURN_ROTATION && discardMode != DiscardMode.TURN_DISCARD;

    if (advanceOnDraw) {
        String nextPlayer = turnService.advanceTurn(sessionId).orElse(null);
        messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", nextPlayer)));
    }

    return ResponseEntity.ok(Map.of("card", card.get()));
}
```

**New discard endpoint:**

```java
@PostMapping("/{sessionId}/discard")
public ResponseEntity<?> discard(@PathVariable String sessionId, @RequestBody DiscardRequest request) {
    if (!sessionService.sessionExists(sessionId)) return ResponseEntity.notFound().build();

    DiscardMode discardMode = sessionService.getDiscardMode(sessionId);
    if (discardMode == DiscardMode.DISCARD_OFF) {
        return ResponseEntity.status(403).body(Map.of("error", "discard is disabled"));
    }

    GameMode mode = sessionService.getGameMode(sessionId);

    if (discardMode == DiscardMode.TURN_DISCARD) {
        Optional<String> currentPlayer = turnService.getCurrentPlayer(sessionId);
        if (currentPlayer.isEmpty() || !currentPlayer.get().equals(request.playerId())) {
            return ResponseEntity.status(403).body(Map.of("error", "not your turn"));
        }
    }

    Optional<String> discarded = deckService.discardCard(sessionId, request.playerId(), request.card());
    if (discarded.isEmpty()) {
        return ResponseEntity.badRequest().body(Map.of("error", "card not in hand"));
    }

    Map<String, Object> payload = new HashMap<>();
    payload.put("playerId", request.playerId());
    payload.put("card", discarded.get());
    payload.put("topDiscard", discarded.get());

    messagingTemplate.convertAndSend("/topic/session/" + sessionId,
            new SessionEvent("CARD_DISCARDED", sessionId, payload));

    // Turn Rotation + Turn Discard: discard ends the turn
    if (mode == GameMode.TURN_ROTATION && discardMode == DiscardMode.TURN_DISCARD) {
        String nextPlayer = turnService.advanceTurn(sessionId).orElse(null);
        messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", nextPlayer)));
    }

    return ResponseEntity.ok(Map.of(
            "card", discarded.get(),
            "topDiscard", discarded.get()
    ));
}
```

**Lobby patch for discard mode** (mirror game-mode):

```java
@PatchMapping("/{sessionId}/discard-mode")
public ResponseEntity<?> updateDiscardMode(
        @PathVariable String sessionId,
        @RequestBody UpdateDiscardModeRequest request) {

    if (!sessionService.sessionExists(sessionId)) {
        return ResponseEntity.notFound().build();
    }

    Optional<String> host = sessionService.getHost(sessionId);
    if (host.isEmpty() || !host.get().equals(request.playerId())) {
        return ResponseEntity.status(403)
                .body(Map.of("error", "only the host can change discard mode"));
    }

    if (sessionService.gameStarted(sessionId)) {
        return ResponseEntity.status(409)
                .body(Map.of("error", "game already started"));
    }

    DiscardMode discardMode = DiscardMode.from(request.discardMode());
    sessionService.setDiscardMode(sessionId, discardMode);

    messagingTemplate.convertAndSend(
            "/topic/session/" + sessionId,
            new SessionEvent("DISCARD_MODE_CHANGED", sessionId,
                    Map.of("discardMode", discardMode.name())));

    return ResponseEntity.ok(Map.of("discardMode", discardMode.name()));
}
```

Also include `discardMode` in `DECK_INITIALIZED` / init response if you want (optional but nice for sync).

---

### 8. `SessionSocketController` — `GAME_STATE`

```java
import com.ava.digitaldeck.model.DiscardMode;

// inside join(), replace the gameState block:
boolean started = sessionService.gameStarted(sessionId);
GameMode mode = sessionService.getGameMode(sessionId);
DiscardMode discardMode = sessionService.getDiscardMode(sessionId);

Map<String, Object> gameState = new HashMap<>();
gameState.put("gameStarted", started);
gameState.put("gameMode", mode.name());
gameState.put("discardMode", discardMode.name());
gameState.put("remaining", started ? deckService.remainingCount(sessionId) : null);
gameState.put("topDiscard",
        started ? deckService.getTopDiscard(sessionId).orElse(null) : null);
gameState.put("currentTurn",
        started && mode == GameMode.TURN_ROTATION
                ? turnService.getCurrentPlayer(sessionId).orElse(null)
                : null);

messagingTemplate.convertAndSend("/topic/session/" + sessionId,
        new SessionEvent("GAME_STATE", sessionId, gameState));
```

---

### 9. Frontend — `types.ts`

```ts
export type GameMode = "TURN_ROTATION" | "FREE_ROTATION";
export type DiscardMode = "DISCARD_OFF" | "TURN_DISCARD" | "FREE_DISCARD";
```

---

### 10. Frontend — `HomeScreen.tsx`

Add `discardMode` + radios (same pattern as game mode):

```tsx
import type { DiscardMode, GameMode } from "./types";

type Props = {
  // ...existing
  discardMode: DiscardMode;
  onDiscardModeChange: (mode: DiscardMode) => void;
};

// in JSX, after game mode radios:
<section>
  <label>
    <input
      type="radio"
      name="discardMode"
      checked={discardMode === "DISCARD_OFF"}
      onChange={() => onDiscardModeChange("DISCARD_OFF")}
    />
    Discard Off
  </label>
  <label>
    <input
      type="radio"
      name="discardMode"
      checked={discardMode === "TURN_DISCARD"}
      onChange={() => onDiscardModeChange("TURN_DISCARD")}
    />
    Turn Discard
  </label>
  <label>
    <input
      type="radio"
      name="discardMode"
      checked={discardMode === "FREE_DISCARD"}
      onChange={() => onDiscardModeChange("FREE_DISCARD")}
    />
    Free Discard
  </label>
</section>
```

---

### 11. Frontend — `LobbyScreen.tsx`

Same idea: host can PATCH discard mode; non-host sees a label.

```tsx
discardMode: DiscardMode;
onUpdateDiscardMode: (mode: DiscardMode) => void;
```

---

### 12. Frontend — `SessionScreen.tsx`

```tsx
type Props = {
  // ...existing
  discardMode: DiscardMode;
  topDiscard: string | null;
  onDiscard: (card: string) => void;
};

const canDiscard =
  discardMode === "FREE_DISCARD" ||
  (discardMode === "TURN_DISCARD" && currentTurn === playerId);

// show pile when not off:
{discardMode !== "DISCARD_OFF" && (
  <p>Discard pile: {topDiscard ?? "(empty)"}</p>
)}

// in hand list:
<ul>
  {hand.map((card, i) => (
    <li key={`${card}-${i}`}>
      {card}
      {canDiscard && (
        <button type="button" onClick={() => onDiscard(card)}>
          Discard
        </button>
      )}
    </li>
  ))}
</ul>
```

Note: with `TURN_DISCARD` + `TURN_ROTATION`, draw no longer ends the turn, so `canDraw` stays true until they discard — that’s intentional.

---

### 13. Frontend — `page.tsx` wiring

State:

```tsx
const [discardMode, setDiscardMode] = useState<DiscardMode>("DISCARD_OFF");
const [topDiscard, setTopDiscard] = useState<string | null>(null);
```

Create body:

```tsx
body: JSON.stringify({ gameMode, discardMode }),
// then:
const { code: newCode, gameMode: createdMode, discardMode: createdDiscard } =
  await createRes.json();
setGameMode(createdMode);
setDiscardMode(createdDiscard);
```

Event handlers:

```tsx
} else if (event.type === "GAME_STATE") {
  setGameStarted(event.payload.gameStarted);
  setRemaining(event.payload.remaining);
  setCurrentTurn(event.payload.currentTurn);
  if (event.payload.gameMode) setGameMode(event.payload.gameMode);
  if (event.payload.discardMode) setDiscardMode(event.payload.discardMode);
  setTopDiscard(event.payload.topDiscard ?? null);
} else if (event.type === "DISCARD_MODE_CHANGED") {
  setDiscardMode(event.payload.discardMode);
} else if (event.type === "CARD_DISCARDED") {
  setTopDiscard(event.payload.topDiscard);
}
```

Discard action:

```tsx
const discardCard = async (card: string) => {
  if (!sessionId) return;

  const res = await fetch(`http://localhost:8080/api/sessions/${sessionId}/discard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, card }),
  });

  if (!res.ok) {
    const error = await res.json();
    alert(error.error ?? "Could not discard");
    return;
  }

  setHand((prev) => {
    const idx = prev.indexOf(card);
    if (idx === -1) return prev;
    return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
  });
};
```

Lobby updater (mirror `updateGameMode`):

```tsx
const updateDiscardMode = async (next: DiscardMode) => {
  if (!sessionId) return;
  const res = await fetch(
    `http://localhost:8080/api/sessions/${sessionId}/discard-mode`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discardMode: next, playerId }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    alert(err.error ?? "Could not update discard mode");
    return;
  }
  setDiscardMode(next);
};
```

Reset on leave:

```tsx
setDiscardMode("DISCARD_OFF");
setTopDiscard(null);
```

Pass props into `HomeScreen` / `LobbyScreen` / `SessionScreen`.

---

## Behavior summary

| Draw mode | Discard mode | Who draws | Who discards | Turn advances on |
|---|---|---|---|---|
| Turn | Off | current | nobody | draw |
| Turn | Turn | current | current | discard |
| Turn | Free | current | anyone | draw |
| Free | Off | anyone | nobody | — |
| Free | Free | anyone | anyone | — |
| Free | Turn | anyone | current\* | — |

\*With Free draw + Turn discard, `currentTurn` is never started today — so either skip advertising that combo in the UI, or later start turns whenever discard/draw needs them. For V1, default Off and prefer Turn+Turn / Free+Free / Turn+Off.

---

## Quick test plan

1. Create with Discard Off → no discard UI; draw still advances turn.
2. Turn Rotation + Turn Discard → draw keeps your turn; discard advances turn; others see `topDiscard`.
3. Free Discard → any player can discard a card from their hand anytime.
4. Refresh → `GAME_STATE` restores `discardMode` + `topDiscard`; hand rehydrate still works.
5. Discard a card you don’t have → `400 card not in hand`.

I'm in Ask mode so this is guidance only — switch to Agent mode if you want it written into the repo.

---
## me
i realized im not using the modeRadios code

---
## Cursor
Correct — that block is dead code.

After the screen split, mode radios live in `HomeScreen` and `LobbyScreen`. `page.tsx` only holds state and handlers (`gameMode`, `setGameMode`, `updateGameMode`), so `modeRadios` is never called.

Safe to delete the whole `modeRadios` definition. It also has a bug if you ever revived it: Free Rotation uses `onSelect` instead of `onChange`, so that radio would never update.

When you add discard mode radios, put them in those same screen components — don’t bring a helper like this back into `page.tsx` unless you extract a shared `ModeRadios` component both screens import.

---
## me
can you check my code i added for the discard setting, i am unable to switch between radio buttons so i want to verify i set it up correctly

---
## Cursor
Found it — the radios are wired to the wrong handler on the home screen.

In `page.tsx` you pass:

```287:288:frontend/app/page.tsx
        discardMode={discardMode}
        onDiscardModeChange={updateDiscardMode}
```

But `updateDiscardMode` bails out when there’s no session:

```257:258:frontend/app/page.tsx
  const updateDiscardMode = async (next: DiscardMode) => {
    if (!sessionId) return;
```

On the create/home screen `sessionId` is `null`, so every click returns immediately and never runs `setDiscardMode`. The radios are controlled (`checked={discardMode === ...}`), so they stay stuck on `DISCARD_OFF`.

That’s the opposite of game mode, which correctly uses local state on home:

```284:284:frontend/app/page.tsx
        onGameModeChange={setGameMode}
```

**Fix:** on Home use local state; on Lobby use the PATCH helper:

```tsx
// HomeScreen
onDiscardModeChange={setDiscardMode}

// LobbyScreen
onUpdateDiscardMode={updateDiscardMode}
```

---

Also, `LobbyScreen` isn’t finished for discard yet:

1. Props declare `discardMode` / `onUpdateDiscardMode`, but they’re not destructured.
2. No discard radios are rendered — only game mode.

So even after the home fix, you still need lobby UI like the game-mode radios, calling `onUpdateDiscardMode(...)`.

---

**Summary:** Home radios don’t switch because they call the lobby/server updater, which no-ops without a `sessionId`. Use `setDiscardMode` on home; keep `updateDiscardMode` for lobby only.
