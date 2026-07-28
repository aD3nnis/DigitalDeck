## me
I want to add an option for game settings to pre set how many cards each person gets. I am curious when do mutliple desks of cards need to come into play?

---
## Cursor
You only need **more than one 52-card deck** when the **initial deal** (or the rules you care about) don’t fit in 52 unique cards.

## The simple math

Your deck today is always one standard pack:

```24:31:backend/src/main/java/com/ava/digitaldeck/services/DeckService.java
    public void initializeDeck(String sessionId) {
        List<String> cards = new ArrayList<>();
        for (String suit : SUITS) {
            for (String rank : RANKS) {
                cards.add(rank + suit);
            }
        }
        Collections.shuffle(cards);
```

So for a “deal N cards to each player at start” setting:

**`players × cardsPerPlayer ≤ 52`** → one deck is enough for the deal  
**`players × cardsPerPlayer > 52`** → you need more decks (or refuse that combo)

Examples:

| Players | Cards each | Total dealt | Decks needed (deal only) |
|--------|------------|-------------|---------------------------|
| 4 | 7 | 28 | 1 |
| 6 | 7 | 42 | 1 |
| 4 | 13 | 52 | 1 (draw pile empty) |
| 5 | 13 | 65 | **2** |
| 8 | 7 | 56 | **2** |

## When “more decks” actually matters

1. **Initial deal overflows one pack**  
   That’s the main case for your settings idea. If the host sets “10 cards each” with 6 players → 60 cards → need a second deck (or clamp/validate).

2. **You want a draw pile left after dealing**  
   Even if the deal fits in 52, games like Go Fish / Crazy Eights usually leave cards in the middle. Example: 4 players × 7 = 28 → 24 left → one deck is fine.  
   4 × 13 = 52 → deal uses the whole deck → nobody can draw unless you reshuffle discards (which you already do).

3. **Game rules want duplicates**  
   Some games (Canasta, some house rules) use 2+ decks on purpose so the same card can appear twice. That’s a rules choice, not just capacity.

4. **Mid-game “running out”**  
   For DigitalDeck specifically, **you often don’t need a second deck just to keep playing**. You already reshuffle the discard pile back into the draw deck when it’s empty. So empty-draw mid-game is already handled without stacking packs — unless you *disable* reshuffle or leave discard off and still expect long draw sessions.

## Practical rule for a settings UI

Treat it as:

```text
deckCount = ceil((players × cardsPerPlayer) / 52)
```

…or keep it simpler for v1:

- Default: **1 deck**, validate `players × handSize ≤ 52`
- Optional host setting: **number of decks** (1–2 or 1–3)
- Or auto: if deal would overflow, bump deck count (and warn the host)

Also decide what “cards each” means:

- **Deal at start only** (then free/turn draw as now), or  
- **Hard hand size** (always hold N — draw/discard keep you at N)

Those are different features; multi-deck mainly cares about the first.

**Bottom line:** multiple desks aren’t required for normal small hands. They kick in when the starting deal (or intentional duplicate-card rules) exceeds one 52-card pack — not merely because people keep drawing later, since you already recycle discards.

---
## me
I think I want a setting in the beginning that host can pick number of decks

---
## Cursor
That’s a good host setting, and it fits cleanly next to draw/discard mode.

## How it should behave

- Host picks **deck count in lobby** (before start), same as game mode / discard mode.
- Freeze it once the game starts (`initDeck`), same gate you already use for mode changes.
- Default to **1**.
- Sensible range for a friend deck app: **1–4** (or 1–3). More than that gets silly fast (208+ cards).

At start, `initializeDeck` builds `deckCount × 52` cards (same ranks/suits repeated), shuffles once, pushes into Redis.

## Mirror your existing settings pattern

Same shape as `gameMode` / `discardMode`:

| Piece | What to add |
|--------|-------------|
| Redis | `session:{id}:deckCount` → `"1"` |
| Create | include `deckCount` in `CreateSessionRequest` |
| Update | `PATCH .../deck-count` (host-only, pre-start) |
| Broadcast | `DECK_COUNT_CHANGED` + include in `GAME_STATE` |
| Init | `DeckService.initializeDeck(sessionId, deckCount)` |

UI: a small number control or radios (`1` / `2` / `3`) on Home + Lobby for the host; non-hosts just see the current value.

## Validation worth doing

- Clamp/parse: reject `0`, negatives, non-integers, and anything above your max.
- If you later add “cards each,” validate:

  `players × cardsPerPlayer ≤ deckCount × 52`

  For deck-count alone, no extra math is required — more decks just means a bigger draw pile and possible duplicate cards (`AS` can appear twice with 2 decks). Your current card strings still work; hands/discard don’t care about uniqueness.

## What you don’t need yet

- Separate physical “deck piles” — one shuffled list of `N×52` is enough.
- Auto-scaling decks from player count — host choice is clearer for a “bring a deck” simulator.
- Changing deck count mid-game — freeze at start like other settings.

**Practical v1:** host sets 1–3 decks in lobby → stored in Redis → used only when `deck/init` builds the list → locked after start.

---
## me
show me the code for this: Practical v1: host sets 1–3 decks in lobby → stored in Redis → used only when deck/init builds the list → locked after start.

---
## Cursor
Here’s a practical v1 that mirrors your existing `gameMode` / `discardMode` flow.

---

### 1. Request model

Update `CreateSessionRequest.java`:

```java
package com.ava.digitaldeck.model;

public record CreateSessionRequest(String gameMode, String discardMode, Integer deckCount) {}
```

New `UpdateDeckCountRequest.java`:

```java
package com.ava.digitaldeck.model;

public record UpdateDeckCountRequest(Integer deckCount, String playerId) {}
```

---

### 2. `SessionService` — store / read / write

```java
public String createSession(GameMode gameMode, DiscardMode discardMode, int deckCount) {
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

    return code;
}

public int getDeckCount(String sessionId) {
    String raw = redisTemplate.opsForValue().get("session:" + sessionId + ":deckCount");
    return parseDeckCount(raw);
}

public void setDeckCount(String sessionId, int deckCount) {
    redisTemplate.opsForValue().set(
            "session:" + sessionId + ":deckCount",
            String.valueOf(clampDeckCount(deckCount)),
            SESSION_TTL
    );
}

public static int clampDeckCount(Integer value) {
    if (value == null) return 1;
    return Math.max(1, Math.min(3, value));
}

private static int parseDeckCount(String raw) {
    if (raw == null || raw.isBlank()) return 1;
    try {
        return clampDeckCount(Integer.parseInt(raw.trim()));
    } catch (NumberFormatException e) {
        return 1;
    }
}
```

---

### 3. `DeckService.initializeDeck` — build N packs

```java
public void initializeDeck(String sessionId, int deckCount) {
    int packs = Math.max(1, Math.min(3, deckCount));
    List<String> cards = new ArrayList<>();
    for (int i = 0; i < packs; i++) {
        for (String suit : SUITS) {
            for (String rank : RANKS) {
                cards.add(rank + suit);
            }
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
```

Duplicate IDs like `"AS"` twice with 2 decks are fine — your hand/discard logic already treats cards as plain strings.

---

### 4. `SessionController` — create, patch, init

**Create:**

```java
@PostMapping
public Map<String, Object> createSession(@RequestBody(required = false) CreateSessionRequest request) {
    GameMode mode = GameMode.from(request == null ? null : request.gameMode());
    DiscardMode discardMode = DiscardMode.from(request == null ? null : request.discardMode());
    int deckCount = SessionService.clampDeckCount(request == null ? null : request.deckCount());
    String code = sessionService.createSession(mode, discardMode, deckCount);
    return Map.of(
            "code", code,
            "gameMode", mode.name(),
            "discardMode", discardMode.name(),
            "deckCount", deckCount
    );
}
```

**Init uses stored count:**

```java
int deckCount = sessionService.getDeckCount(sessionId);
deckService.initializeDeck(sessionId, deckCount);
```

**New PATCH (host-only, locked after start):**

```java
@PatchMapping("/{sessionId}/deck-count")
public ResponseEntity<?> updateDeckCount(
        @PathVariable String sessionId,
        @RequestBody UpdateDeckCountRequest request) {

    if (!sessionService.sessionExists(sessionId)) {
        return ResponseEntity.notFound().build();
    }

    Optional<String> host = sessionService.getHost(sessionId);
    if (host.isEmpty() || !host.get().equals(request.playerId())) {
        return ResponseEntity.status(403)
                .body(Map.of("error", "only the host can change deck count"));
    }

    if (sessionService.gameStarted(sessionId)) {
        return ResponseEntity.status(409)
                .body(Map.of("error", "game already started"));
    }

    int deckCount = SessionService.clampDeckCount(request.deckCount());
    sessionService.setDeckCount(sessionId, deckCount);

    messagingTemplate.convertAndSend(
            "/topic/session/" + sessionId,
            new SessionEvent("DECK_COUNT_CHANGED", sessionId,
                    Map.of("deckCount", deckCount)));

    return ResponseEntity.ok(Map.of("deckCount", deckCount));
}
```

---

### 5. `SessionSocketController` — include in `GAME_STATE`

```java
gameState.put("gameStarted", started);
gameState.put("gameMode", mode.name());
gameState.put("discardMode", discardMode.name());
gameState.put("deckCount", sessionService.getDeckCount(sessionId));
gameState.put("remaining", started ? deckService.remainingCount(sessionId) : null);
// ... rest unchanged
```

---

### 6. Frontend — state + wire-up in `page.tsx`

```ts
const [deckCount, setDeckCount] = useState(1);
```

In the STOMP handler:

```ts
} else if (event.type === "GAME_STATE") {
  // ...existing...
  if (event.payload.deckCount != null) setDeckCount(event.payload.deckCount);
} else if (event.type === "DECK_COUNT_CHANGED") {
  setDeckCount(event.payload.deckCount);
}
```

Create body:

```ts
body: JSON.stringify({ gameMode, discardMode, deckCount }),
```

and accept `deckCount` from the create response.

Lobby updater (same pattern as discard mode):

```ts
const updateDeckCount = async (next: number) => {
  if (!sessionId) return;
  const res = await fetch(
    `http://localhost:8080/api/sessions/${sessionId}/deck-count`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckCount: next, playerId }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    alert(err.error ?? "Could not update deck count");
    return;
  }
  setDeckCount(next);
};
```

Reset on leave: `setDeckCount(1)`.

Pass `deckCount` / handlers into `HomeScreen` and `LobbyScreen`.

---

### 7. UI — radios `1` / `2` / `3`

**Lobby (host editable, guests read-only):**

```tsx
{isHost ? (
  <section>
    <p>Decks</p>
    {[1, 2, 3].map((n) => (
      <label key={n}>
        <input
          type="radio"
          name="deckCount"
          checked={deckCount === n}
          onChange={() => onUpdateDeckCount(n)}
        />
        {n}
      </label>
    ))}
  </section>
) : (
  <p>Decks: {deckCount}</p>
)}
```

Same radio block on `HomeScreen` for create-time choice (`onDeckCountChange={setDeckCount}`).

---

### Lock behavior (already covered)

`gameStarted()` is “deck Redis key exists,” so:

1. Host can PATCH deck count in lobby.
2. `deck/init` reads Redis and builds `deckCount × 52`.
3. After init, PATCH returns **409** — same as mode changes.

That’s the full v1 path. If you want, switch to Agent mode and I can apply it; otherwise you can paste these pieces file by file.

---
