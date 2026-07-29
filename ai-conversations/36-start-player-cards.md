## me
i want there next to be an option in the lobby for the host to be able to pick how many cards a person gets at the start of the game. This should take from the decks that are used in the game. I need to handle the edge case that if too many people join the session wont start until the host picks the right start cards to deck ratio. I need to figure out what i want to do If a person joins the session late and more cards are necessary if that person just needs to wait until the discard pile is reshuffled or if they can't join at all or another deck gets added

---
## Cursor
Here’s a clean way to think about it, then a recommendation that fits DigitalDeck.

## What “cards at start” means

Treat it as a **one-time deal at `deck/init`**, not a permanent hand size:

1. Build `deckCount × 52` cards, shuffle.
2. For each player in `playerOrder`, deal `cardsPerPlayer` from the draw pile into their hand.
3. Leftover cards stay in the draw pile for normal draws.

`0` = today’s behavior (no deal, everyone starts empty).

---

## Pre-start ratio (you already know the rule)

```text
players × cardsPerPlayer  ≤  deckCount × 52
```

| Host UI | Server |
|--------|--------|
| Show live math: “4 players × 7 = 28 / 52 OK” or “6 × 10 = 60 / 52 — need more decks or fewer cards” | Reject `deck/init` with 400 if invalid |
| Disable **Start** while invalid | Don’t trust the client alone |

Host fixes it by changing **decks**, **cards each**, or waiting for people to leave. Session can stay open; only start is blocked.

Also decide whether to leave a draw pile. Optional soft warning (not a hard block):

```text
remainingAfterDeal = decks×52 − players×cardsPerPlayer
```

If that’s `0`, start can still be legal, but nobody can draw until discard reshuffles (and discard needs cards first). For many games you’ll want `remainingAfterDeal > 0`, but that’s a product choice.

---

## Late join: the real decision

Three different people show up “after start”:

| Who | What you want |
|-----|----------------|
| **Same player refresh/rejoin** | Already handled — keep hand, don’t re-deal |
| **Brand-new player mid-game** | This is the design choice |
| **Spectator** | Optional later |

### Options for a brand-new late joiner

| Option | Behavior | Pros | Cons |
|--------|----------|------|------|
| **A. Empty hand, play from draw pile** | Join OK, 0 starting cards, draw like everyone else | Simple; matches “you sat down mid-game”; works with reshuffle | They start behind if the game needed a full dealt hand |
| **B. Deal if enough remain** | If `remaining ≥ cardsPerPlayer`, deal them; else fall back to A (or refuse) | Fair when the pile is fat | Uneven if some late joiners get a deal and later ones don’t |
| **C. Block new joins after start** | Only existing `playerId`s can rejoin | No fairness questions | Breaks “friend shows up late”; must carefully allow reconnect |
| **D. Auto-add a deck** | Inject another 52 mid-game | Always can deal | Surprising, changes odds, not how a physical table works |
| **E. Wait for reshuffle then deal** | Queue a “pending deal” | Clever | Complicated; weird timing; hard to explain |

---

## Recommendation for your app

DigitalDeck is a **shared physical deck**, not a fixed ruleset like Uno with official late-join rules. So:

**1. Pre-start:** hard gate on ratio (UI + server).  
**2. Late join v1: Option A** — new players can join, get **no starting deal**, empty hand, draw/discard with everyone else. Reshuffle already keeps the game going; they don’t need a special “wait for reshuffle” path.

Why not the others for v1:

- **D (auto deck)** — feels like cheating the setup the host chose; avoid.
- **C (block joins)** — fights your existing late-join / refresh model unless you special-case reconnects.
- **E (deal after reshuffle)** — a lot of state for little gain.
- **B** — nice **v1.1** if you want: “late joiner gets a starting hand only when the draw pile still has enough.”

Mental model to tell players:

> Starting cards are dealt once when the host starts. If you join late, you sit down with an empty hand and draw from what’s left (including after discard reshuffles).

That matches a real table better than spawning a new deck or freezing the lobby.

---

## Optional host setting (if you want the choice explicit)

In lobby, under cards-each:

- **Late joiners:** `Draw only` (default) | `Deal if cards remain`

Still never auto-add decks. If deal isn’t possible, join succeeds with empty hand (or show a toast: “Not enough cards left to deal — draw normally”).

---

## Minimal rules summary

```text
Lobby:
  decks ∈ 1..3
  cardsPerPlayer ∈ 0..N   (cap N somehow, e.g. 20)
  canStart = players * cardsPerPlayer <= decks * 52

Start:
  shuffle decks*52
  deal cardsPerPlayer to each player in playerOrder
  lock settings

Late NEW player:
  join allowed
  hand = []          # v1
  optional later: deal if remaining >= cardsPerPlayer

Reconnect same playerId:
  keep existing hand (no second deal)
```

---

If you want a single default without more toggles: **gate start on ratio + late joiners get empty hands**. That’s the smallest coherent v1; you can add “deal late joiners when possible” later without changing Redis much.

Which way are you leaning for late joiners — A (empty hand) or B (deal when remaining allows)? I can sketch the deal-at-init + validation code next to match that choice.

--- 
## me
I'm leaning Option A

---
## Cursor
Option A locks in a simple rule: **starting hands are only for people in the lobby when the host starts. Late joiners sit down empty and draw.**

No join changes needed — your current join already does that. The new work is lobby setting + deal-at-init + start gate.

---

### Locked product rules

```text
cardsPerPlayer ∈ 0..20     (0 = no deal, today’s behavior)
canStart = players × cardsPerPlayer ≤ deckCount × 52

Start: shuffle → deal to current playerOrder → lock settings
Late NEW player: join OK, hand = [], draw/discard as usual
Reconnect same playerId: keep hand (already how you work)
Never auto-add a deck mid-game
```

---

### Backend — store like `deckCount`

Redis: `session:{id}:cardsPerPlayer`

In `SessionService` (same pattern as deck count):

```java
public static int clampCardsPerPlayer(Integer value) {
    if (value == null) return 0;
    return Math.max(0, Math.min(20, value));
}

public int getCardsPerPlayer(String sessionId) { /* parse Redis, default 0 */ }
public void setCardsPerPlayer(String sessionId, int n) { /* clamp + set */ }

public List<String> getPlayerOrder(String sessionId) {
    List<String> order = redisTemplate.opsForList()
            .range("session:" + sessionId + ":playerOrder", 0, -1);
    return order == null ? List.of() : order;
}

public boolean canDealStartingHands(String sessionId) {
    int players = getPlayerOrder(sessionId).size();
    int need = players * getCardsPerPlayer(sessionId);
    int have = getDeckCount(sessionId) * 52;
    return need <= have;
}
```

Wire into `createSession`, `CreateSessionRequest`, and a `PATCH .../cards-per-player` (host-only, 409 if game started) — copy your deck-count endpoint.

Include `cardsPerPlayer` in `GAME_STATE`.

---

### Backend — deal only at init

`DeckService`:

```java
/** Deal N cards to each player from the top of the deck. Returns total dealt. */
public int dealStartingHands(String sessionId, List<String> playerIds, int cardsPerPlayer) {
    if (cardsPerPlayer <= 0 || playerIds.isEmpty()) return 0;
    int dealt = 0;
    for (String playerId : playerIds) {
        for (int i = 0; i < cardsPerPlayer; i++) {
            String card = redisTemplate.opsForList()
                    .leftPop("session:" + sessionId + ":deck");
            if (card == null) break; // shouldn't happen if canDeal checked
            String handKey = "session:" + sessionId + ":hands:" + playerId;
            redisTemplate.opsForList().rightPush(handKey, card);
            redisTemplate.expire(handKey, SESSION_TTL);
            dealt++;
        }
    }
    return dealt;
}
```

`initDeck` gate + deal:

```java
if (!sessionService.canDealStartingHands(sessionId)) {
    return ResponseEntity.badRequest().body(Map.of(
            "error", "not enough cards for starting hands — lower cards each, add decks, or wait for fewer players"
    ));
}

int deckCount = sessionService.getDeckCount(sessionId);
int cardsPerPlayer = sessionService.getCardsPerPlayer(sessionId);
deckService.initializeDeck(sessionId, deckCount);
deckService.dealStartingHands(sessionId, sessionService.getPlayerOrder(sessionId), cardsPerPlayer);

// DECK_INITIALIZED payload should include remaining AFTER deal
```

After start, each player already in the session should **rehydrate their hand** (you already have `GET .../hand`). Easiest: on `DECK_INITIALIZED`, every client calls `rehydrateHand(sessionId)` so dealt cards show up without a private broadcast.

---

### Frontend — lobby UX

Host control (number input or radios). Guests see the value.

Live gate next to Start:

```ts
const playerCount = Object.keys(roster).length;
const totalNeeded = playerCount * cardsPerPlayer;
const totalAvailable = deckCount * 52;
const canStart = totalNeeded <= totalAvailable;
```

```tsx
{isHost && (
  <>
    {!canStart && (
      <p>
        Need {totalNeeded} cards but only have {totalAvailable}.
        Lower starting cards, add a deck, or wait for someone to leave.
      </p>
    )}
    <button onClick={onStart} disabled={!canStart}>Start game</button>
  </>
)}
```

Server still enforces — UI disable is for clarity.

On `DECK_INITIALIZED` / `GAME_STATE` with `gameStarted: true`, call `rehydrateHand` so starters see dealt cards. Late joiners get `hand: []` from that same endpoint — that’s Option A working.

---

### What you explicitly do *not* do

| Temptation | Skip |
|------------|------|
| Deal late joiners | Option A — no |
| Block late joins | Breaks friends + complicates reconnect |
| Auto-add deck when someone joins mid-game | No |
| Re-deal on refresh | Same `playerId` keeps existing hand |

---

### Test checklist

1. 2 players, 1 deck, 7 each → start OK, each has 7, remaining 38  
2. 6 players, 1 deck, 10 each → Start disabled + init returns 400  
3. Fix by decks=2 or cards=5 → start works  
4. Mid-game new joiner → roster updates, empty hand, can draw  
5. Refresh a starter → same hand via rehydrate  

That’s the whole Option A shape on top of your existing deck-count work. If you want the full file-by-file paste next (like the deck-count guide), say so — or switch to Agent mode to have it applied.

---
## me

can you show me the full code of what needs to be put to complete deal-at-start + start gate

---
## Cursor
Full paste guide for **deal-at-start + start gate** on top of your current deck-count work. Late join stays Option A (no join changes).

---

### 1. New request model

`backend/src/main/java/com/ava/digitaldeck/model/UpdateCardsPerPlayerRequest.java`

```java
package com.ava.digitaldeck.model;

public record UpdateCardsPerPlayerRequest(Integer cardsPerPlayer, String playerId) {}
```

Update `CreateSessionRequest.java`:

```java
package com.ava.digitaldeck.model;

public record CreateSessionRequest(
        String gameMode,
        String discardMode,
        Integer deckCount,
        Integer cardsPerPlayer
) {}
```

---

### 2. `SessionService` — store, clamp, gate helpers

Replace `createSession` signature and body to also store cards-per-player, and add these methods (keep existing deck-count helpers):

```java
public String createSession(GameMode gameMode, DiscardMode discardMode, int deckCount, int cardsPerPlayer) {
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
    redisTemplate.opsForValue().set(
            "session:" + sessionId + ":deckCount",
            String.valueOf(clampDeckCount(deckCount)),
            SESSION_TTL
    );
    redisTemplate.opsForValue().set(
            "session:" + sessionId + ":cardsPerPlayer",
            String.valueOf(clampCardsPerPlayer(cardsPerPlayer)),
            SESSION_TTL
    );

    return code;
}

public int getCardsPerPlayer(String sessionId) {
    String raw = redisTemplate.opsForValue().get("session:" + sessionId + ":cardsPerPlayer");
    return parseCardsPerPlayer(raw);
}

public void setCardsPerPlayer(String sessionId, int cardsPerPlayer) {
    redisTemplate.opsForValue().set(
            "session:" + sessionId + ":cardsPerPlayer",
            String.valueOf(clampCardsPerPlayer(cardsPerPlayer)),
            SESSION_TTL
    );
}

public static int clampCardsPerPlayer(Integer value) {
    if (value == null) return 0;
    return Math.max(0, Math.min(20, value));
}

private static int parseCardsPerPlayer(String raw) {
    if (raw == null || raw.isBlank()) return 0;
    try {
        return clampCardsPerPlayer(Integer.parseInt(raw.trim()));
    } catch (NumberFormatException e) {
        return 0;
    }
}

public List<String> getPlayerOrder(String sessionId) {
    List<String> order = redisTemplate.opsForList()
            .range("session:" + sessionId + ":playerOrder", 0, -1);
    return order == null ? List.of() : order;
}

/** players × cardsPerPlayer ≤ deckCount × 52 */
public boolean canDealStartingHands(String sessionId) {
    int players = getPlayerOrder(sessionId).size();
    int need = players * getCardsPerPlayer(sessionId);
    int have = getDeckCount(sessionId) * 52;
    return need <= have;
}
```

---

### 3. `DeckService` — deal after shuffle

Add after `initializeDeck`:

```java
/**
 * Deal cardsPerPlayer to each player from the top of the draw pile.
 * Caller must ensure enough cards remain.
 * Returns total cards dealt.
 */
public int dealStartingHands(String sessionId, List<String> playerIds, int cardsPerPlayer) {
    if (cardsPerPlayer <= 0 || playerIds == null || playerIds.isEmpty()) {
        return 0;
    }
    String deckKey = "session:" + sessionId + ":deck";
    int dealt = 0;
    for (String playerId : playerIds) {
        String handKey = "session:" + sessionId + ":hands:" + playerId;
        // Clear any leftover hand key from a previous abandoned attempt
        redisTemplate.delete(handKey);
        for (int i = 0; i < cardsPerPlayer; i++) {
            String card = redisTemplate.opsForList().leftPop(deckKey);
            if (card == null) {
                return dealt;
            }
            redisTemplate.opsForList().rightPush(handKey, card);
            dealt++;
        }
        redisTemplate.expire(handKey, SESSION_TTL);
    }
    return dealt;
}
```

---

### 4. `SessionController` — create, init gate+deal, PATCH

**Create** — update to pass/return `cardsPerPlayer`:

```java
@PostMapping
public Map<String, Object> createSession(@RequestBody(required = false) CreateSessionRequest request) {
    GameMode mode = GameMode.from(request == null ? null : request.gameMode());
    DiscardMode discardMode = DiscardMode.from(request == null ? null : request.discardMode());
    int deckCount = SessionService.clampDeckCount(request == null ? null : request.deckCount());
    int cardsPerPlayer = SessionService.clampCardsPerPlayer(
            request == null ? null : request.cardsPerPlayer());
    String code = sessionService.createSession(mode, discardMode, deckCount, cardsPerPlayer);
    return Map.of(
            "code", code,
            "gameMode", mode.name(),
            "discardMode", discardMode.name(),
            "deckCount", deckCount,
            "cardsPerPlayer", cardsPerPlayer
    );
}
```

**Init** — replace the middle of `initDeck` (after the already-started check):

```java
if (!sessionService.canDealStartingHands(sessionId)) {
    int players = sessionService.getPlayerOrder(sessionId).size();
    int cardsPerPlayer = sessionService.getCardsPerPlayer(sessionId);
    int deckCount = sessionService.getDeckCount(sessionId);
    return ResponseEntity.badRequest().body(Map.of(
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
String currentPlayer = null;

messagingTemplate.convertAndSend("/topic/session/" + sessionId,
        new SessionEvent("DECK_INITIALIZED", sessionId, Map.of(
                "remaining", deckService.remainingCount(sessionId),
                "gameMode", mode.name(),
                "cardsPerPlayer", cardsPerPlayer
        )));

if (mode == GameMode.TURN_ROTATION) {
    turnService.startTurns(sessionId);
    currentPlayer = turnService.getCurrentPlayer(sessionId).orElse(null);
    messagingTemplate.convertAndSend("/topic/session/" + sessionId,
            new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", currentPlayer)));
}

return ResponseEntity.ok(Map.of(
        "remaining", deckService.remainingCount(sessionId),
        "currentTurn", currentPlayer,
        "gameMode", mode.name(),
        "cardsPerPlayer", cardsPerPlayer
));
```

**New PATCH** (mirror deck-count):

```java
@PatchMapping("/{sessionId}/cards-per-player")
public ResponseEntity<?> updateCardsPerPlayer(
        @PathVariable String sessionId,
        @RequestBody UpdateCardsPerPlayerRequest request) {

    if (!sessionService.sessionExists(sessionId)) {
        return ResponseEntity.notFound().build();
    }

    Optional<String> host = sessionService.getHost(sessionId);
    if (host.isEmpty() || !host.get().equals(request.playerId())) {
        return ResponseEntity.status(403)
                .body(Map.of("error", "only the host can change cards per player"));
    }

    if (sessionService.gameStarted(sessionId)) {
        return ResponseEntity.status(409)
                .body(Map.of("error", "game already started"));
    }

    int cardsPerPlayer = SessionService.clampCardsPerPlayer(request.cardsPerPlayer());
    sessionService.setCardsPerPlayer(sessionId, cardsPerPlayer);

    messagingTemplate.convertAndSend(
            "/topic/session/" + sessionId,
            new SessionEvent("CARDS_PER_PLAYER_CHANGED", sessionId,
                    Map.of("cardsPerPlayer", cardsPerPlayer)));

    return ResponseEntity.ok(Map.of("cardsPerPlayer", cardsPerPlayer));
}
```

Add import:

```java
import com.ava.digitaldeck.model.UpdateCardsPerPlayerRequest;
```

---

### 5. `SessionSocketController` — `GAME_STATE`

Add one line with the other settings:

```java
gameState.put("deckCount", sessionService.getDeckCount(sessionId));
gameState.put("cardsPerPlayer", sessionService.getCardsPerPlayer(sessionId));
```

---

### 6. Frontend — `LobbyScreen.tsx` (full relevant additions)

Update props + gate + UI:

```tsx
"use client";

import type { DiscardMode, GameMode } from "./types";

type Props = {
  code: string | null;
  roster: Record<string, string>;
  playerId: string;
  hostId: string | null;
  gameMode: GameMode;
  discardMode: DiscardMode;
  deckCount: number;
  cardsPerPlayer: number;
  onUpdateGameMode: (mode: GameMode) => void;
  onUpdateDiscardMode: (mode: DiscardMode) => void;
  onUpdateDeckCount: (count: number) => void;
  onUpdateCardsPerPlayer: (count: number) => void;
  onStart: () => void;
  onLeave: () => void;
};

export default function LobbyScreen({
  code,
  roster,
  playerId,
  hostId,
  gameMode,
  discardMode,
  deckCount,
  cardsPerPlayer,
  onUpdateGameMode,
  onUpdateDiscardMode,
  onUpdateDeckCount,
  onUpdateCardsPerPlayer,
  onStart,
  onLeave,
}: Props) {
  const isHost = playerId === hostId;
  const playerCount = Object.keys(roster).length;
  const needed = playerCount * cardsPerPlayer;
  const available = deckCount * 52;
  const canStart = needed <= available;

  return (
    <main>
      {/* ... existing roster / gameMode / discardMode / decks sections ... */}

      {isHost ? (
        <section>
          <label>
            Cards each at start:{" "}
            <input
              type="number"
              min={0}
              max={20}
              value={cardsPerPlayer}
              onChange={(e) =>
                onUpdateCardsPerPlayer(Number(e.target.value) || 0)
              }
            />
          </label>
          <p>
            Need {needed} / {available} cards
            {!canStart && " — lower cards each, add a deck, or wait for fewer players"}
          </p>
        </section>
      ) : (
        <p>Cards each at start: {cardsPerPlayer}</p>
      )}

      {isHost && (
        <button onClick={onStart} disabled={!canStart}>
          Start game
        </button>
      )}
      <button onClick={onLeave}>Leave session</button>
    </main>
  );
}
```

Keep your existing mode/discard/decks blocks; only add the cards-each section and change the Start button as above.

---

### 7. Frontend — `page.tsx` wiring

**State:**

```ts
const [cardsPerPlayer, setCardsPerPlayer] = useState(0);
```

**STOMP handlers** — extend existing branches:

```ts
} else if (event.type === "DECK_INITIALIZED") {
  setGameStarted(true);
  setRemaining(event.payload.remaining);
  if (event.payload.gameMode) setGameMode(event.payload.gameMode);
  if (event.payload.cardsPerPlayer != null) {
    setCardsPerPlayer(event.payload.cardsPerPlayer);
  }
  rehydrateHand(resolvedSessionId); // dealt hands land here
} else if (event.type === "GAME_STATE") {
  // ...existing...
  if (event.payload.deckCount != null) setDeckCount(event.payload.deckCount);
  if (event.payload.cardsPerPlayer != null) {
    setCardsPerPlayer(event.payload.cardsPerPlayer);
  }
  if (event.payload.gameStarted) {
    rehydrateHand(resolvedSessionId);
  }
} else if (event.type === "CARDS_PER_PLAYER_CHANGED") {
  setCardsPerPlayer(event.payload.cardsPerPlayer);
}
```

**Create body:**

```ts
body: JSON.stringify({ gameMode, discardMode, deckCount, cardsPerPlayer }),
```

and after create:

```ts
const {
  code: newCode,
  gameMode: createdMode,
  discardMode: createdDiscard,
  deckCount: createdDecks,
  cardsPerPlayer: createdCards,
} = await createRes.json();
setGameMode(createdMode);
setDiscardMode(createdDiscard);
if (createdDecks != null) setDeckCount(createdDecks);
if (createdCards != null) setCardsPerPlayer(createdCards);
```

**Start with error surfacing:**

```ts
const startGame = async () => {
  if (!sessionId) return;
  const res = await fetch(
    `http://localhost:8080/api/sessions/${sessionId}/deck/init?playerId=${playerId}`,
    { method: "POST" }
  );
  if (!res.ok) {
    const err = await res.json();
    alert(err.error ?? "Could not start game");
  }
};
```

**Updater:**

```ts
const updateCardsPerPlayer = async (next: number) => {
  if (!sessionId) return;
  const clamped = Math.max(0, Math.min(20, next));
  const res = await fetch(
    `http://localhost:8080/api/sessions/${sessionId}/cards-per-player`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardsPerPlayer: clamped, playerId }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    alert(err.error ?? "Could not update cards per player");
    return;
  }
  setCardsPerPlayer(clamped);
};
```

**Leave reset:** `setCardsPerPlayer(0);`

**Lobby props:**

```tsx
<LobbyScreen
  {/* ...existing... */}
  deckCount={deckCount}
  cardsPerPlayer={cardsPerPlayer}
  onUpdateDeckCount={updateDeckCount}
  onUpdateCardsPerPlayer={updateCardsPerPlayer}
/>
```

Optional: also pass `cardsPerPlayer` / `onCardsPerPlayerChange={setCardsPerPlayer}` into `HomeScreen` if you want it choosable before create (same pattern as modes). Lobby-only is enough for v1 since create defaults to `0`.

---

### Behavior checklist after wiring

| Case | Expected |
|------|----------|
| `cardsPerPlayer = 0` | Same as today — no deal |
| 2 players, 7 each, 1 deck | Start OK; each hand has 7; remaining 38 |
| Ratio too high | Start disabled; init returns 400 |
| Late joiner | Empty hand, draws normally |
| Starter on `DECK_INITIALIZED` | `rehydrateHand` shows dealt cards |

That’s the complete deal-at-start + start-gate path. I'm in Ask mode so I can’t apply it — switch to Agent mode if you want it written into the repo for you.

---
## me
is it set up where 20 is the max one player can have? because i cant put a number bigger than 20

---
## Cursor
Yes — **20 is an intentional soft cap**, not something the browser invented on its own. It’s enforced in three places:

1. **Lobby input** — `max={20}`
2. **Frontend PATCH** — `Math.min(20, next)`
3. **Backend** — `clampCardsPerPlayer` → `Math.min(20, value)`

That was just a v1 sanity limit from the design (`0..20`), not a rule of cards. The **real** limit is still:

```text
players × cardsPerPlayer ≤ deckCount × 52
```

So with 3 decks a single player could theoretically start with up to **156** cards; 20 was only a UI/API ceiling.

If you want higher (e.g. 52), raise all three clamps to the same number — or drop the fixed max and rely only on the start gate.