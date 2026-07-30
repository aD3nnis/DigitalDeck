## me
i implemented the above, now i want to work on a section for play. There is many different types i think for this when brainstorming because in War your cards do not overlap when you play so the way that I want this to work is everyone has their own individual play section. When you play a card however, everyone will be able to see that card on their screen. You can play multiple cards at once. To end your turn you can select your played cards and discard them or do it via the other methods which would be discard from your hand.

---
## Cursor
### Core idea

Treat **Play** as a third zone, separate from hand and the shared discard pile:

| Zone | Whose | Visible to |
|------|--------|------------|
| Hand | You | Only you |
| **Play area** | One per player | Everyone |
| Discard pile | Shared | Everyone |

War fits: each person has their own face-up play strip; cards don’t stack into one Uno-style pile.

---

### Actions you described

1. **Play** — move selected cards from **your hand → your play area** (order = selection order; last selected can be “top” of *your* pile if you care later).
2. **Discard from hand** — existing path (hand → shared discard).
3. **Discard from play** — selected cards in **your play area → shared discard**.

Ending the turn (under Turn Discard): **any successful discard** that your policy already treats as turn-ending — whether the cards came from hand or from your play area. Playing alone should **not** end the turn (otherwise you can’t “play then discard played cards to finish”).

---

### Lobby setting (mirror discard)

```text
playMode: PLAY_OFF | TURN_PLAY | FREE_PLAY
```

| Mode | Who can play hand → their area |
|------|--------------------------------|
| `PLAY_OFF` | No play UI / action |
| `TURN_PLAY` | Current player only |
| `FREE_PLAY` | Anyone anytime |

Independent of discard, same as draw vs discard. Useful combos:

| Draw | Play | Discard | Feels like |
|------|------|---------|------------|
| Turn | Turn | Turn | War-ish skeleton: play face-up, then discard to resolve / end turn |
| Turn | Turn | Off | Play to tableaus only (no shared discard yet) |
| Free | Free | Free | Casual tabletop dump |
| Turn | Off | Turn | Current Rummy-ish (hand discard only) |

---

### Turn advancement (keep it simple)

Extend the rule you already use:

- **Play never advances the turn.**
- **Discard advances the turn** only when `TURN_DISCARD` + `TURN_ROTATION` — source is hand **or** play area.
- If discard is off, turn still advances on draw (today’s behavior) unless you add an explicit “End turn” later.

So flow on your turn with Turn Play + Turn Discard:

1. Draw (optional)  
2. Play some cards to your area (optional, multi OK)  
3. Discard from hand **or** from your play area → turn ends  

---

### Data / sync shape

```text
session:{id}:play:{playerId}  → list of cards (that player’s face-up area)
```

Events everyone needs:

- `CARDS_PLAYED` — `{ playerId, cards }` (append to that player’s area on every client)
- `CARD_DISCARDED` — already have; add optional `from: "HAND" | "PLAY"` and which cards left whose play area
- `GAME_STATE` / rehydrate — include `playAreas: { [playerId]: string[] }` for joiners

UI: section “Table” with one block per roster player; yours is selectable; others are read-only.

---

### Multi-card play

Same as batch discard: one `POST /play` with `cards: string[]` in selection order. No turn advance. Everyone sees all of them appear in your strip.

---

### Discard-from-play API

Either:

- `POST /discard` with `{ playerId, cards, source: "HAND" | "PLAY" }`, or  
- `POST /play/discard` that only pulls from the play list  

Prefer **one discard endpoint + `source`** so turn policy stays in one place: one permit, one advance, last card = top discard.

---

### Things to decide before coding

1. **Can you only discard your own play area?** (Yes for v1.)  
2. **Can others’ play cards be taken/won?** (War winner — later; v1 just visible areas + discard.)  
3. **Deselect / return play → hand?** Useful; optional v1.5 (“Recall”).  
4. **Empty play area required to end turn?** No for v1 — discard from hand can still end turn with cards left on the table (house-rule flexible).  
5. **Play with Discard Off?** Allowed — cards sit in play areas forever until you add another sink (or force play mode off when discard off if that confuses you).

---

### Suggested v1 scope

1. `playMode` lobby setting (default `PLAY_OFF`)  
2. Per-player play lists + broadcast  
3. Batch play from hand  
4. Select-in-your-play-area → discard (same turn rules as hand discard)  
5. UI: everyone’s play strips + your Play button next to Discard  

Skip for now: winning tricks, overlapping shared pile, play limits, recalling to hand.

That’s the brainstorm shape that matches “individual play sections, visible to all, multi-play, end turn by discarding played cards or from hand.” If you want next, we can sketch exact Redis keys + `SessionScreen` layout, or the `permitPlay` / discard-`source` controller shapes.

---
## me
with this model what card games would not be playable?
--- 
## Cursor
With **per-player play areas + shared discard + draw/play/discard timing levers only** (no suit rules, no shared center pile, no betting, no “take from opponent”), a lot of games are only half-supported or not really playable as the real game.

### Poor fit / not really playable

| Game | Why this model breaks |
|------|------------------------|
| **Uno, Crazy Eights, Phase 10 (play-to-pile)** | Need **one shared play/discard** you must match; not private strips |
| **Hearts, Spades, Bridge, Euchre, Oh Hell** | Need a **shared trick** that clears to a winner each round; follow-suit/trump |
| **President / Big Two / Tien Len** | Shared climb pile + rank/combo legality |
| **Egyptian Rat Screw / slap jacks** | Shared center stack + real-time claim |
| **Texas Hold’em / most poker** | Community board, betting, muck — not “play to your area then discard” |
| **Go Fish / Old Maid (full rules)** | Ask/steal and pair-out rules, not a play tableau |
| **Memory / Concentration** | Shared face-down grid |
| **Cribbage** | Shared pegging pile + crib + scoring |
| **Canasta / full Rummy (strict)** | Melds, laying off on **others’** sets, draw-from-discard rules |
| **Exploding Kittens / Fluxx-likes** | Targeting, special decks, interrupt timing |

### Partial fit (tabletop skeleton only)

| Game | What works | What’s missing |
|------|------------|----------------|
| **War** | Each player’s face-up play strip, multi-card “war” dump | Winner takes both piles into a **win/stock** pile |
| **Blackjack** | Per-seat cards visible | Dealer rules, hit/stand, betting, soft/hard totals |
| **Casual “show your cards”** | Play to your area for all to see | Nothing — this *is* the model |
| **Gin / Rummy-ish** | Draw + discard from hand | Knocking, deadwood, meld validation, discard-draw |
| **Solitaire multiplayer house rules** | Personal tableaus | Foundations, build rules |

### What *is* playable as intended

- House-rule / teaching setups: deal, draw in turns, park cards face-up in front of you, dump to a shared discard  
- “Reveal then clear” toys that **look** like War without automatic winning  
- Any game where the only verbs are **draw / show in my zone / discard**

### Short rule of thumb

This model fails when the real game needs any of:

1. **One shared play pile** (Uno, tricks, climbing)  
2. **Rules about what may be played** (suit, rank, combo)  
3. **Moving cards between players’ areas** (winner takes, steal, fish)  
4. **Hidden shared state** (board, crib, memory grid)  
5. **Economy outside cards** (chips, bidding)

So: great for **visible personal tableaus + discard**; not a substitute for classic shared-pile or trick-taking games until you add those as separate modes later (e.g. `SHARED_PLAY_PILE` vs `PER_PLAYER_PLAY`).

---
## me
here is where my interpretation may be different. I think of the single shared place where people place cards over each other is the discard pile. So uno would still work if you think of the discard pile as where you must match, does that make sense?

---
## Cursor
Yes — that interpretation is valid and common. In Uno / Crazy Eights, the pile you play onto **is** the discard pile (one shared stack; top card is what you must match).

### How that maps to your app

| Real game idea | Your zones |
|----------------|------------|
| Play onto the match pile | **Discard** (shared; last discarded = top / match target) |
| Cards in hand | **Hand** |
| Optional “in front of me” staging | **Per-player play area** |

So Uno doesn’t need a fourth “shared play pile” if **discard = the play-to pile**. Your existing “last selected becomes top of discard” already matches “this is what’s face-up for the next player.”

### Where interpretations diverge

The fork isn’t “does Uno use discard?” — it’s **must every play go straight to discard, or can cards sit in a personal area first?**

- **Uno-like:** hand → **discard** (your Play button might mean “play to discard,” or you only use Discard and skip personal areas).
- **War-like:** hand → **my play strip** (visible staging); later maybe discard / resolve.
- **Your hybrid:** both exist — stage in play area, *or* discard from hand onto the shared pile.

That hybrid is coherent: discard is always the shared stack; personal play is optional staging.

### What still isn’t “full Uno” (even with that model)

Spatially, yes. As a **rules engine**, you’d still need later:

- Only play if card matches top discard (color/rank/wild)
- Turn direction, skips, draw-twos, etc.
- Often: play **one** card to discard ends turn (not a free multi-dump unless house rules)

None of that blocks treating discard as the Uno pile; it’s just enforcement on top.

### Bottom line

Your reading makes sense: **shared overlapping stack = discard**. Personal play areas are for games where cards sit face-up per player; Uno can ignore those and use **hand → discard** as “play.” Same discard pile, two verbs depending on the game.

---
## me
do you have access to my project files? If so I want you to tell me where in the code i need to make the code changes to implement this

--- 
## Cursor
Yes. Here’s where to touch the repo for **play mode + per-player play areas + discard from play**, mirroring how discard already works.

---

### New files (backend models)

| File | Why |
|------|-----|
| `backend/.../model/PlayMode.java` | Like `DiscardMode.java` — `PLAY_OFF`, `TURN_PLAY`, `FREE_PLAY` |
| `backend/.../model/PlayRequest.java` | `{ playerId, cards }` for hand → play area |
| `backend/.../model/UpdatePlayModeRequest.java` | Like `UpdateDiscardModeRequest.java` |

Optionally extend `DiscardRequest.java` with `source: "HAND" | "PLAY"` instead of a second discard endpoint.

---

### Backend — persistence & rules

| File | Changes |
|------|---------|
| **`SessionService.java`** | Store/read `session:{id}:playMode` in `createSession`, add `getPlayMode` / `setPlayMode` (same pattern as discardMode ~lines 45–46, 125–133) |
| **`DeckService.java`** | Play lists: `session:{id}:play:{playerId}` — `playCards`, `getPlayArea`, `getAllPlayAreas`, `discardFromPlay` (and clear play keys in deck init/reset) |
| **`TurnActionPolicy.java`** | Add `permitPlay` (mirror `permitDiscard`); play should **not** advance turn. Discard-from-play reuses `permitDiscard` + same `advanceTurnAfter` |
| **`CreateSessionRequest.java`** | Add optional `playMode` |
| **`SessionController.java`** | Create response includes `playMode`; `PATCH .../play-mode`; `POST .../play`; extend `POST .../discard` with `source`; broadcast `CARDS_PLAYED` / richer `CARD_DISCARDED` |
| **`SessionSocketController.java`** | `GAME_STATE` payload: add `playMode` + `playAreas` map (next to discardMode ~82–92) |
| **`GameStartService.java`** | Include `playMode` on start/`DECK_INITIALIZED` if you emit settings there; clear play areas when dealing |
| **`LobbySettingsService.java`** | No new logic if you keep using `updateWhileInLobby` from the controller (same as discard-mode) |

`TurnService.java` / `DisconnectGraceService.java` — only if leaving should clear that player’s play area (nice-to-have).

---

### Frontend — types & lobby

| File | Changes |
|------|---------|
| **`frontend/components/types.ts`** | `PlayMode` type + optional `coercePlayMode` if Free Rotation shouldn’t allow `TURN_PLAY` |
| **`HomeScreen.tsx`** | Radios for play mode (like discard) |
| **`LobbyScreen.tsx`** | Host can change play mode; show current value |
| **`page.tsx`** | State: `playMode`, `playAreas`; create/join body; `PATCH play-mode`; `playCards()`; discard with `source`; STOMP handlers for `PLAY_MODE_CHANGED`, `CARDS_PLAYED`, `GAME_STATE.playAreas` |
| **`SessionScreen.tsx`** | Everyone’s play strips; select your play cards; **Play** (hand → your area); Discard from hand vs from play |

---

### Suggested order

1. `PlayMode` + `SessionService` get/set + create/lobby PATCH (settings only, no cards yet)  
2. `DeckService` play-area methods + clear on init  
3. `POST /play` + `TurnActionPolicy.permitPlay` + socket `GAME_STATE` / `CARDS_PLAYED`  
4. Extend discard with `source: "PLAY"`  
5. Frontend lobby → `page.tsx` wiring → `SessionScreen` UI  

---

### What you can leave alone (for v1)

- `WebSocketConfig.java`, `ConnectionRegistry.java`, join/leave request models  
- Matching rules (Uno legality) — not needed for zones  
- `PingController` / Redis test controllers  

I can’t edit in Ask mode; switch to Agent mode if you want this implemented file-by-file.

---
## me
now show me the code changes and where they should be changed

---
## Cursor
Below is a file-by-file recipe that matches your repo. Do backend first, then frontend.

---

### 1. NEW `backend/.../model/PlayMode.java`

```java
package com.ava.digitaldeck.model;

public enum PlayMode {
    PLAY_OFF,
    TURN_PLAY,
    FREE_PLAY;

    public static PlayMode from(String value) {
        if (value == null || value.isBlank()) {
            return PLAY_OFF;
        }
        return PlayMode.valueOf(value.trim().toUpperCase());
    }
}
```

### 2. NEW `backend/.../model/PlayRequest.java`

```java
package com.ava.digitaldeck.model;

import java.util.List;

public record PlayRequest(String playerId, List<String> cards) {}
```

### 3. NEW `backend/.../model/UpdatePlayModeRequest.java`

```java
package com.ava.digitaldeck.model;

public record UpdatePlayModeRequest(String playMode, String playerId) {}
```

### 4. CHANGE `DiscardRequest.java`

```java
package com.ava.digitaldeck.model;

import java.util.List;

/** source: "HAND" (default) or "PLAY" */
public record DiscardRequest(String playerId, List<String> cards, String source) {}
```

---

### 5. CHANGE `CreateSessionRequest.java`

Add `playMode`:

```java
public record CreateSessionRequest(
        String gameMode,
        String discardMode,
        String playMode,
        Integer deckCount,
        Integer cardsPerPlayer
) {}
```

---

### 6. CHANGE `SessionService.java`

**`createSession` signature** — add `PlayMode playMode`, and after discardMode write:

```java
redisTemplate.opsForValue().set(
        "session:" + sessionId + ":playMode",
        playMode.name(),
        SESSION_TTL
);
```

**Add getters/setters** (next to discardMode methods ~125–136):

```java
public PlayMode getPlayMode(String sessionId) {
    String raw = redisTemplate.opsForValue().get("session:" + sessionId + ":playMode");
    return PlayMode.from(raw);
}

public void setPlayMode(String sessionId, PlayMode playMode) {
    redisTemplate.opsForValue().set(
            "session:" + sessionId + ":playMode",
            playMode.name(),
            SESSION_TTL
    );
}
```

Import `PlayMode`. Update every `createSession(...)` call site (`SessionController.createSession`).

---

### 7. CHANGE `DeckService.java`

**In `initializeDeck`**, clear play areas for players (or add helper called from `GameStartService`). Simplest: after deleting discard, also:

```java
// call clearAllPlayAreas(sessionId, playerIds) from GameStartService after you know the roster
```

**Add methods:**

```java
private String playKey(String sessionId, String playerId) {
    return "session:" + sessionId + ":play:" + playerId;
}

public void clearPlayArea(String sessionId, String playerId) {
    redisTemplate.delete(playKey(sessionId, playerId));
}

public void clearAllPlayAreas(String sessionId, List<String> playerIds) {
    for (String playerId : playerIds) {
        clearPlayArea(sessionId, playerId);
    }
}

/** hand → this player's play area (order preserved; last = top of their strip). */
public List<String> playCards(String sessionId, String playerId, List<String> cards) {
    if (cards == null || cards.isEmpty()) return List.of();
    String handKey = "session:" + sessionId + ":hands:" + playerId;
    String playKey = playKey(sessionId, playerId);
    List<String> played = new ArrayList<>();
    for (String card : cards) {
        if (card == null || card.isBlank()) break;
        Long removed = redisTemplate.opsForList().remove(handKey, 1, card);
        if (removed == null || removed == 0) break;
        redisTemplate.opsForList().rightPush(playKey, card);
        played.add(card);
    }
    redisTemplate.expire(handKey, SESSION_TTL);
    redisTemplate.expire(playKey, SESSION_TTL);
    return played;
}

public List<String> getPlayArea(String sessionId, String playerId) {
    List<String> cards = redisTemplate.opsForList().range(playKey(sessionId, playerId), 0, -1);
    return cards == null ? List.of() : cards;
}

public Map<String, List<String>> getAllPlayAreas(String sessionId, List<String> playerIds) {
    Map<String, List<String>> areas = new HashMap<>();
    for (String playerId : playerIds) {
        areas.put(playerId, getPlayArea(sessionId, playerId));
    }
    return areas;
}

/** play area → shared discard. */
public Optional<String> discardFromPlay(String sessionId, String playerId, String card) {
    if (card == null || card.isBlank()) return Optional.empty();
    String playKey = playKey(sessionId, playerId);
    Long removed = redisTemplate.opsForList().remove(playKey, 1, card);
    if (removed == null || removed == 0) return Optional.empty();
    String discardKey = "session:" + sessionId + ":discard";
    redisTemplate.opsForList().rightPush(discardKey, card);
    redisTemplate.expire(discardKey, SESSION_TTL);
    redisTemplate.expire(playKey, SESSION_TTL);
    return Optional.of(card);
}

public List<String> discardCardsFromPlay(String sessionId, String playerId, List<String> cards) {
    if (cards == null || cards.isEmpty()) return List.of();
    List<String> discarded = new ArrayList<>();
    for (String card : cards) {
        Optional<String> one = discardFromPlay(sessionId, playerId, card);
        if (one.isEmpty()) break;
        discarded.add(one.get());
    }
    return discarded;
}
```

---

### 8. CHANGE `TurnActionPolicy.java`

Add import `PlayMode`, then:

```java
/** Play never advances the turn. */
public Permit permitPlay(String sessionId, String playerId) {
    PlayMode playMode = sessionService.getPlayMode(sessionId);
    if (playMode == PlayMode.PLAY_OFF) {
        return new Permit.Denied("play is disabled");
    }
    if (playMode == PlayMode.TURN_PLAY && !isCurrentPlayer(sessionId, playerId)) {
        return new Permit.Denied("not your turn");
    }
    return new Permit.Allowed(false);
}
```

`permitDiscard` stays as-is (turn ends on discard from hand **or** play).

---

### 9. CHANGE `SessionController.java`

**Create** — parse + return playMode; pass into `createSession`.

**Discard** — branch on source:

```java
String source = request.source() == null ? "HAND" : request.source().trim().toUpperCase();
List<String> discarded = "PLAY".equals(source)
        ? deckService.discardCardsFromPlay(sessionId, request.playerId(), cards)
        : deckService.discardCards(sessionId, request.playerId(), cards);
// error message: "card not in hand" vs "card not in play"
payload.put("source", source);
```

**New play endpoint** (near discard):

```java
@PostMapping("/{sessionId}/play")
public ResponseEntity<?> play(@PathVariable String sessionId, @RequestBody PlayRequest request) {
    if (!sessionService.sessionExists(sessionId)) {
        return ResponseEntity.notFound().build();
    }
    List<String> cards = request.cards();
    if (cards == null || cards.isEmpty()) {
        return ResponseEntity.badRequest().body(Map.of("error", "no cards"));
    }

    TurnActionPolicy.Permit permit = turnActionPolicy.permitPlay(sessionId, request.playerId());
    if (permit instanceof TurnActionPolicy.Permit.Denied(String error)) {
        return ResponseEntity.status(403).body(Map.of("error", error));
    }

    List<String> played = deckService.playCards(sessionId, request.playerId(), cards);
    if (played.isEmpty() || played.size() != cards.size()) {
        return ResponseEntity.badRequest().body(Map.of("error", "card not in hand", "played", played));
    }

    Map<String, Object> payload = new HashMap<>();
    payload.put("playerId", request.playerId());
    payload.put("cards", played);
    payload.put("playArea", deckService.getPlayArea(sessionId, request.playerId()));

    messagingTemplate.convertAndSend(
            "/topic/session/" + sessionId,
            new SessionEvent("CARDS_PLAYED", sessionId, payload));

    // do NOT maybeAdvanceTurn
    return ResponseEntity.ok(Map.of(
            "cards", played,
            "playArea", payload.get("playArea")
    ));
}
```

**New PATCH** (copy discard-mode block):

```java
@PatchMapping("/{sessionId}/play-mode")
public ResponseEntity<?> updatePlayMode(...) {
    PlayMode playMode = PlayMode.from(request.playMode());
    return toResponse(lobbySettingsService.updateWhileInLobby(
            sessionId, request.playerId(),
            () -> sessionService.setPlayMode(sessionId, playMode),
            "PLAY_MODE_CHANGED",
            () -> Map.of("playMode", playMode.name()),
            () -> Map.of("playMode", playMode.name())
    ));
}
```

---

### 10. CHANGE `SessionSocketController.java` (`GAME_STATE` ~80–96)

```java
PlayMode playMode = sessionService.getPlayMode(sessionId);
gameState.put("playMode", playMode.name());
if (started) {
    gameState.put("playAreas",
            deckService.getAllPlayAreas(sessionId, sessionService.getPlayerOrder(sessionId)));
} else {
    gameState.put("playAreas", Map.of());
}
```

---

### 11. CHANGE `GameStartService.java`

After `initializeDeck`, before/after deal:

```java
deckService.clearAllPlayAreas(sessionId, sessionService.getPlayerOrder(sessionId));
```

Optionally add `playMode` to `DECK_INITIALIZED` payload.

---

### 12. CHANGE `frontend/components/types.ts`

```ts
export type PlayMode = "PLAY_OFF" | "TURN_PLAY" | "FREE_PLAY";

export function isPlayModeAllowed(gameMode: GameMode, playMode: PlayMode): boolean {
  if (gameMode === "FREE_ROTATION" && playMode === "TURN_PLAY") return false;
  return true;
}

export function coercePlayMode(gameMode: GameMode, playMode: PlayMode): PlayMode {
  return isPlayModeAllowed(gameMode, playMode) ? playMode : "PLAY_OFF";
}
```

---

### 13. CHANGE `HomeScreen.tsx` / `LobbyScreen.tsx`

Mirror discard radios: `playMode`, `onPlayModeChange` / `onUpdatePlayMode`, options Off / Turn (only if Turn Rotation) / Free.

---

### 14. CHANGE `page.tsx`

- State: `playMode`, `playAreas: Record<string, string[]>`
- Create body includes `playMode`
- STOMP: `PLAY_MODE_CHANGED`, `CARDS_PLAYED` → update `playAreas[playerId]`, `GAME_STATE` → set both
- Replace stub:

```ts
const playCards = async (cards: string[]): Promise<boolean> => {
  if (!sessionId || cards.length === 0) return false;
  const res = await fetch(`http://localhost:8080/api/sessions/${sessionId}/play`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, cards }),
  });
  if (!res.ok) {
    const error = await res.json();
    alert(error.error ?? "Could not play");
    return false;
  }
  const { playArea } = await res.json();
  setHand((prev) => {
    let next = [...prev];
    for (const card of cards) {
      const idx = next.indexOf(card);
      if (idx !== -1) next = [...next.slice(0, idx), ...next.slice(idx + 1)];
    }
    return next;
  });
  setPlayAreas((prev) => ({ ...prev, [playerId]: playArea }));
  return true;
};
```

- Discard with source:

```ts
body: JSON.stringify({ playerId, cards, source: "HAND" }) // or "PLAY"
```

Pass `playMode`, `playAreas`, `onDiscardFromPlay` (or one `onDiscard(cards, source)`) into `SessionScreen`.

---

### 15. CHANGE `SessionScreen.tsx`

- Props: `playMode`, `playAreas`, change `onDiscard` to `(cards, source) => ...` or add `onDiscardFromPlay`
- Show Play when `playMode !== "PLAY_OFF"` (not nested only under discard)
- `canPlay` like `canDiscard`
- Render everyone’s play strips from `playAreas` + `roster`
- Second selection list for **your** play area → Discard with `source: "PLAY"`
- Hand Play button → `onPlay(selectedCards())` (hand → your area)

Rough structure:

```tsx
{/* Table */}
{playMode !== "PLAY_OFF" && (
  <section>
    <h2>Play areas</h2>
    {Object.entries(roster).map(([id, name]) => (
      <div key={id}>
        <h3>{name}{id === playerId ? " (you)" : ""}</h3>
        <ul>{/* cards; only your strip is clickable */}</ul>
      </div>
    ))}
  </section>
)}
```

---

### Order to apply

1. Models + `SessionService`  
2. `DeckService` play methods + clear on start  
3. `TurnActionPolicy.permitPlay`  
4. Controller play + discard `source` + socket `GAME_STATE`  
5. Types → Home/Lobby → `page.tsx` → `SessionScreen`

I'm in Ask mode so this is guidance only — switch to Agent mode if you want it applied in the repo.

---
## me
(I notice Cursor window is not working as well as I would like so I asked for Cursor in my IDE what needed to be added from steps 1-9)

---
## Cursor (IDE)
**Done (1–6):** models, `SessionService`, most of `DeckService` play methods, `GameStartService` call site, and most of `POST /play`.

**Still missing / broken** — exact code below.

---

### 1. `DeckService.java` — add clear helpers (called from `GameStartService` but methods don’t exist)

Put next to `playKey` (end of file is fine):

```java
public void clearPlayArea(String sessionId, String playerId) {
    redisTemplate.delete(playKey(sessionId, playerId));
}

public void clearAllPlayAreas(String sessionId, List<String> playerIds) {
    if (playerIds == null) return;
    for (String playerId : playerIds) {
        clearPlayArea(sessionId, playerId);
    }
}
```

---

### 2. `TurnActionPolicy.java` — entire `permitPlay` is missing

Add import:

```java
import com.ava.digitaldeck.model.PlayMode;
```

Add method (after `permitDiscard`):

```java
/** Play never advances the turn. */
public Permit permitPlay(String sessionId, String playerId) {
    PlayMode playMode = sessionService.getPlayMode(sessionId);
    if (playMode == PlayMode.PLAY_OFF) {
        return new Permit.Denied("play is disabled");
    }
    if (playMode == PlayMode.TURN_PLAY && !isCurrentPlayer(sessionId, playerId)) {
        return new Permit.Denied("not your turn");
    }
    return new Permit.Allowed(false);
}
```

---

### 3. `SessionController.java` — four gaps

**A. Missing imports** (you use `PlayRequest` / `UpdatePlayModeRequest` without importing them):

```java
import com.ava.digitaldeck.model.PlayRequest;
import com.ava.digitaldeck.model.UpdatePlayModeRequest;
```

**B. `createSession` response** — parse/pass is done; add `"playMode"` to the return map:

```java
return Map.of(
        "code", code,
        "gameMode", mode.name(),
        "discardMode", discardMode.name(),
        "playMode", playMode.name(),
        "deckCount", deckCount,
        "cardsPerPlayer", cardsPerPlayer
);
```

**C. Replace entire `discard` method body branching** — current code always uses hand. Replace the discard-from-hand-only block with:

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

    String source = request.source() == null ? "HAND" : request.source().trim().toUpperCase();
    List<String> discarded = "PLAY".equals(source)
            ? deckService.discardCardsFromPlay(sessionId, request.playerId(), cards)
            : deckService.discardCards(sessionId, request.playerId(), cards);

    String notFoundError = "PLAY".equals(source) ? "card not in play" : "card not in hand";
    String partialError = "PLAY".equals(source) ? "some cards not in play" : "some cards not in hand";

    if (discarded.isEmpty()) {
        return ResponseEntity.badRequest().body(Map.of("error", notFoundError));
    }
    if (discarded.size() != cards.size()) {
        return ResponseEntity.badRequest().body(Map.of(
                "error", partialError,
                "discarded", discarded,
                "topDiscard", discarded.get(discarded.size() - 1)
        ));
    }

    String topDiscard = discarded.get(discarded.size() - 1);

    Map<String, Object> payload = new HashMap<>();
    payload.put("playerId", request.playerId());
    payload.put("cards", discarded);
    payload.put("topDiscard", topDiscard);
    payload.put("source", source);

    messagingTemplate.convertAndSend(
            "/topic/session/" + sessionId,
            new SessionEvent("CARD_DISCARDED", sessionId, payload));

    maybeAdvanceTurn(sessionId, advanceTurn);

    return ResponseEntity.ok(Map.of(
            "cards", discarded,
            "topDiscard", topDiscard,
            "source", source
    ));
}
```

**D. Fix broken `updatePlayMode`** — you pasted a stub (`updatePlayMode(...)`). Replace with:

```java
@PatchMapping("/{sessionId}/play-mode")
public ResponseEntity<?> updatePlayMode(
        @PathVariable String sessionId,
        @RequestBody UpdatePlayModeRequest request) {

    PlayMode playMode = PlayMode.from(request.playMode());

    return toResponse(lobbySettingsService.updateWhileInLobby(
            sessionId,
            request.playerId(),
            () -> sessionService.setPlayMode(sessionId, playMode),
            "PLAY_MODE_CHANGED",
            () -> Map.of("playMode", playMode.name()),
            () -> Map.of("playMode", playMode.name())
    ));
}
```

`POST /play` itself looks complete once `PlayRequest` is imported.

---

### 4. `SessionSocketController.java` — missing import (code already uses `PlayMode`)

```java
import com.ava.digitaldeck.model.PlayMode;
```

(`playMode` + `playAreas` in `GAME_STATE` are already there.)

---

### Checklist vs your recipe

| Item | Status |
|------|--------|
| 1–5 models | Done |
| 6 `SessionService` | Done |
| 7 `DeckService` play/discard-from-play/getters | Done |
| 7 `clearPlayArea` / `clearAllPlayAreas` | **Missing** (call site already in `GameStartService`) |
| 8 `permitPlay` | **Missing** |
| 9 create response `playMode` | **Missing** |
| 9 discard `source` branch | **Missing** |
| 9 `POST /play` | Done (needs import) |
| 9 `PATCH /play-mode` | **Broken stub** |
| Socket `PlayMode` import | **Missing** |

Backend of this recipe is otherwise in place. Frontend (`types`, lobby, `page.tsx`, `SessionScreen`) is still untouched if you’re going file-by-file. Switch to Agent mode if you want these edits applied.

---
## me
13. CHANGE HomeScreen.tsx / LobbyScreen.tsx
Mirror discard radios: playMode, onPlayModeChange / onUpdatePlayMode, options Off / Turn (only if Turn Rotation) / Free.

---
## Cursor (IDE)
`types.ts` already has `PlayMode` / coerce helpers. For Step 13, mirror discard like this:

---

### `HomeScreen.tsx`

**Import + props:**

```tsx
import type { DiscardMode, GameMode, PlayMode } from "./types";

type Props = {
  displayName: string;
  joinCodeInput: string;
  gameMode: GameMode;
  clientReady: boolean;
  discardMode: DiscardMode;
  playMode: PlayMode;
  onDisplayNameChange: (name: string) => void;
  onJoinCodeChange: (code: string) => void;
  onGameModeChange: (mode: GameMode) => void;
  onCreate: () => void;
  onJoin: () => void;
  onDiscardModeChange: (mode: DiscardMode) => void;
  onPlayModeChange: (mode: PlayMode) => void;
};
```

**Destructure** (add next to discard):

```tsx
  discardMode,
  onDiscardModeChange,
  playMode,
  onPlayModeChange,
```

**UI** — paste a new `<section>` right after the discard section:

```tsx
      <section>
        <label>
          <input
            type="radio"
            name="playMode"
            checked={playMode === "PLAY_OFF"}
            onChange={() => onPlayModeChange("PLAY_OFF")}
          />
          Play Off
        </label>

        {gameMode === "TURN_ROTATION" && (
          <label>
            <input
              type="radio"
              name="playMode"
              checked={playMode === "TURN_PLAY"}
              onChange={() => onPlayModeChange("TURN_PLAY")}
            />
            Turn Play
          </label>
        )}

        <label>
          <input
            type="radio"
            name="playMode"
            checked={playMode === "FREE_PLAY"}
            onChange={() => onPlayModeChange("FREE_PLAY")}
          />
          Free Play
        </label>
      </section>
```

---

### `LobbyScreen.tsx`

**Import + props:**

```tsx
import type { DiscardMode, GameMode, PlayMode } from "./types";

type Props = {
  code: string | null;
  roster: Record<string, string>;
  playerId: string;
  hostId: string | null;
  gameMode: GameMode;
  discardMode: DiscardMode;
  playMode: PlayMode;
  deckCount: number;
  cardsPerPlayer: number;
  onUpdateGameMode: (mode: GameMode) => void;
  onUpdateDiscardMode: (mode: DiscardMode) => void;
  onUpdatePlayMode: (mode: PlayMode) => void;
  onUpdateDeckCount: (count: number) => void;
  onUpdateCardsPerPlayer: (count: number) => void;
  onStart: () => void;
  onLeave: () => void;
};
```

**Destructure:**

```tsx
  discardMode,
  playMode,
  deckCount,
  cardsPerPlayer,
  onUpdateGameMode,
  onUpdateDiscardMode,
  onUpdatePlayMode,
  onUpdateDeckCount,
  onUpdateCardsPerPlayer,
```

**UI** — after the discard host/guest block, before decks:

```tsx
      {isHost ? (
        <section>
          <label>
            <input
              type="radio"
              name="playMode"
              checked={playMode === "PLAY_OFF"}
              onChange={() => onUpdatePlayMode("PLAY_OFF")}
            />
            Play Off
          </label>
          {gameMode === "TURN_ROTATION" && (
            <label>
              <input
                type="radio"
                name="playMode"
                checked={playMode === "TURN_PLAY"}
                onChange={() => onUpdatePlayMode("TURN_PLAY")}
              />
              Turn Play
            </label>
          )}
          <label>
            <input
              type="radio"
              name="playMode"
              checked={playMode === "FREE_PLAY"}
              onChange={() => onUpdatePlayMode("FREE_PLAY")}
            />
            Free Play
          </label>
        </section>
      ) : (
        <p>
          Play Mode:{" "}
          {playMode === "PLAY_OFF"
            ? "Play Off"
            : playMode === "TURN_PLAY"
              ? "Turn Play"
              : "Free Play"}
        </p>
      )}
```

---

`page.tsx` still needs to wire `playMode` state, `onPlayModeChange` / `onUpdatePlayMode`, and pass those props — Step 14. Until then these components will not typecheck.

---
## me
so please show me step 14
---
## Cursor
### Step 14 — `page.tsx` (exact pieces)

Your lobby already expects `playMode` / `onUpdatePlayMode`; home expects them too. Wire them here.

---

**1. Imports**

```ts
import type { DiscardMode, GameMode, PlayMode } from "../components/types";
import { coerceDiscardMode, coercePlayMode } from "../components/types";
```

---

**2. State** (next to `discardMode`)

```ts
const [discardMode, setDiscardMode] = useState<DiscardMode>("DISCARD_OFF");
const [playMode, setPlayMode] = useState<PlayMode>("PLAY_OFF");
const [playAreas, setPlayAreas] = useState<Record<string, string[]>>({});
```

**Update `handleGameModeChange`:**

```ts
const handleGameModeChange = (next: GameMode) => {
  setGameMode(next);
  setDiscardMode((prev) => coerceDiscardMode(next, prev));
  setPlayMode((prev) => coercePlayMode(next, prev));
};
```

---

**3. STOMP handlers** (inside `subscribeAndJoin`)

In `GAME_STATE` block, add:

```ts
if (event.payload.playMode) setPlayMode(event.payload.playMode);
if (event.payload.playAreas) setPlayAreas(event.payload.playAreas);
```

Add new branches (near `DISCARD_MODE_CHANGED` / `CARD_DISCARDED`):

```ts
} else if (event.type === "PLAY_MODE_CHANGED") {
  setPlayMode(event.payload.playMode);
} else if (event.type === "CARDS_PLAYED") {
  setPlayAreas((prev) => ({
    ...prev,
    [event.payload.playerId]: event.payload.playArea,
  }));
} else if (event.type === "CARD_DISCARDED") {
  setTopDiscard(event.payload.topDiscard);
  if (event.payload.source === "PLAY" && event.payload.playerId) {
    setPlayAreas((prev) => {
      const area = [...(prev[event.payload.playerId] ?? [])];
      for (const card of event.payload.cards as string[]) {
        const idx = area.indexOf(card);
        if (idx !== -1) area.splice(idx, 1);
      }
      return { ...prev, [event.payload.playerId]: area };
    });
  }
}
```

(Replace your existing bare `CARD_DISCARDED` branch with the block above.)

---

**4. Create session** — include `playMode`

```ts
body: JSON.stringify({ gameMode, discardMode, playMode, deckCount, cardsPerPlayer }),
```

And after parse:

```ts
const {
  code: newCode,
  gameMode: createdMode,
  discardMode: createdDiscard,
  playMode: createdPlay,
  deckCount: createdDecks,
  cardsPerPlayer: createdCards,
} = await createRes.json();
setGameMode(createdMode);
setDiscardMode(createdDiscard);
if (createdPlay) setPlayMode(createdPlay);
```

---

**5. `updateGameMode`** — also coerce play

```ts
setGameMode(next);

const nextDiscard = coerceDiscardMode(next, discardMode);
if (nextDiscard !== discardMode) {
  await updateDiscardMode(nextDiscard);
}

const nextPlay = coercePlayMode(next, playMode);
if (nextPlay !== playMode) {
  await updatePlayMode(nextPlay);
}
```

---

**6. `leaveSession` reset**

```ts
setDiscardMode("DISCARD_OFF");
setPlayMode("PLAY_OFF");
setPlayAreas({});
setTopDiscard(null);
```

---

**7. Discard with `source`** — replace `discardCards`

```ts
const discardCards = async (
  cards: string[],
  source: "HAND" | "PLAY" = "HAND"
): Promise<boolean> => {
  if (!sessionId || cards.length === 0) return false;

  const res = await fetch(`http://localhost:8080/api/sessions/${sessionId}/discard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, cards, source }),
  });

  if (!res.ok) {
    const error = await res.json();
    alert(error.error ?? "Could not discard");
    return false;
  }

  const { cards: discarded } = await res.json();

  if (source === "HAND") {
    setHand((prev) => {
      let next = [...prev];
      for (const card of discarded as string[]) {
        const idx = next.indexOf(card);
        if (idx !== -1) next = [...next.slice(0, idx), ...next.slice(idx + 1)];
      }
      return next;
    });
  } else {
    setPlayAreas((prev) => {
      let area = [...(prev[playerId] ?? [])];
      for (const card of discarded as string[]) {
        const idx = area.indexOf(card);
        if (idx !== -1) area = [...area.slice(0, idx), ...area.slice(idx + 1)];
      }
      return { ...prev, [playerId]: area };
    });
  }
  return true;
};
```

---

**8. Replace `playCards` stub**

```ts
const playCards = async (cards: string[]): Promise<boolean> => {
  if (!sessionId || cards.length === 0) return false;
  const res = await fetch(`http://localhost:8080/api/sessions/${sessionId}/play`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, cards }),
  });
  if (!res.ok) {
    const error = await res.json();
    alert(error.error ?? "Could not play");
    return false;
  }
  const { playArea } = await res.json();
  setHand((prev) => {
    let next = [...prev];
    for (const card of cards) {
      const idx = next.indexOf(card);
      if (idx !== -1) next = [...next.slice(0, idx), ...next.slice(idx + 1)];
    }
    return next;
  });
  setPlayAreas((prev) => ({ ...prev, [playerId]: playArea }));
  return true;
};
```

---

**9. Add `updatePlayMode`** (mirror `updateDiscardMode`)

```ts
const updatePlayMode = async (next: PlayMode) => {
  if (!sessionId) return;
  const res = await fetch(
    `http://localhost:8080/api/sessions/${sessionId}/play-mode`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playMode: next, playerId }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    alert(err.error ?? "Could not update play mode");
    return;
  }
  setPlayMode(next);
};
```

---

**10. Pass props**

**HomeScreen** — add:

```tsx
playMode={playMode}
onPlayModeChange={setPlayMode}
```

**LobbyScreen** — you already pass `playMode` / `onUpdatePlayMode`; keep that (needs `updatePlayMode` from §9).

**SessionScreen** — for now keep `onDiscard={discardCards}` / `onPlay={playCards}`. After Step 15, also pass:

```tsx
playMode={playMode}
playAreas={playAreas}
onDiscard={(cards) => discardCards(cards, "HAND")}
onDiscardFromPlay={(cards) => discardCards(cards, "PLAY")}
```

(or one `onDiscard(cards, source)` if you change the prop type in Step 15).

---

Until Step 15 updates `SessionScreen` props, TypeScript will complain if you pass `playMode` / `playAreas` early — wire those on `SessionScreen` in Step 15.

---
## me
show me step 15 and change to being onDiscard(cards, source)

---
## Cursor
### Step 15 — `SessionScreen.tsx` with `onDiscard(cards, source)`

Replace the file with this shape (mirrors your current hand-selection pattern; adds play strips + a second selection for **your** play area):

```tsx
"use client";

import type { DiscardMode, GameMode, PlayMode } from "./types";
import { useEffect, useState } from "react";

type Props = {
  roster: Record<string, string>;
  playerId: string;
  gameMode: GameMode;
  currentTurn: string | null;
  hand: string[];
  remaining: number | null;
  discardMode: DiscardMode;
  playMode: PlayMode;
  playAreas: Record<string, string[]>;
  topDiscard: string | null;
  onDraw: () => void;
  onLeave: () => void;
  onDiscard: (cards: string[], source: "HAND" | "PLAY") => Promise<boolean>;
  onPlay: (cards: string[]) => Promise<boolean>;
  statusMessage: string | null;
};

export default function SessionScreen({
  roster,
  playerId,
  gameMode,
  currentTurn,
  hand,
  remaining,
  onDraw,
  onLeave,
  discardMode,
  playMode,
  playAreas,
  topDiscard,
  onDiscard,
  statusMessage,
  onPlay,
}: Props) {
  const canDraw =
    gameMode === "FREE_ROTATION" || currentTurn === playerId;
  const canDiscard =
    discardMode === "FREE_DISCARD" ||
    (discardMode === "TURN_DISCARD" && currentTurn === playerId);
  const canPlay =
    playMode === "FREE_PLAY" ||
    (playMode === "TURN_PLAY" && currentTurn === playerId);

  const myPlayArea = playAreas[playerId] ?? [];

  const [selected, setSelected] = useState<number[]>([]);
  const [playSelected, setPlaySelected] = useState<number[]>([]);

  const toggle = (i: number) => {
    setSelected((prev) => {
      const at = prev.indexOf(i);
      if (at !== -1) return prev.filter((_, j) => j !== at);
      return [...prev, i];
    });
  };

  const togglePlay = (i: number) => {
    setPlaySelected((prev) => {
      const at = prev.indexOf(i);
      if (at !== -1) return prev.filter((_, j) => j !== at);
      return [...prev, i];
    });
  };

  const selectedCards = () => selected.map((i) => hand[i]);
  const selectedPlayCards = () => playSelected.map((i) => myPlayArea[i]);

  useEffect(() => {
    setSelected([]);
  }, [hand]);

  useEffect(() => {
    setPlaySelected([]);
  }, [myPlayArea]);

  return (
    <main>
      <h1>Game</h1>

      <h2>Players</h2>
      <ul>
        {Object.entries(roster).map(([id, name]) => (
          <li key={id}>
            {name} <small>({id})</small>
          </li>
        ))}
      </ul>

      {gameMode === "TURN_ROTATION" && (
        <p>
          Current turn: {currentTurn ? roster[currentTurn] ?? currentTurn : "—"}
          {currentTurn === playerId && " (this is you!)"}
        </p>
      )}

      {canDraw && <button onClick={onDraw}>Draw card</button>}

      <p>Cards remaining: {remaining}</p>

      {discardMode !== "DISCARD_OFF" && (
        <p>Discard pile: {topDiscard ?? "(empty)"}</p>
      )}
      {statusMessage && <p>{statusMessage}</p>}

      {playMode !== "PLAY_OFF" && (
        <section>
          <h2>Play areas</h2>
          {Object.entries(roster).map(([id, name]) => {
            const area = playAreas[id] ?? [];
            const isMine = id === playerId;
            return (
              <div key={id}>
                <h3>
                  {name}
                  {isMine ? " (you)" : ""}
                </h3>
                <ul>
                  {area.length === 0 ? (
                    <li>(empty)</li>
                  ) : (
                    area.map((card, i) => {
                      if (!isMine) {
                        return <li key={`${id}-${card}-${i}`}>{card}</li>;
                      }
                      const order = playSelected.indexOf(i);
                      const isSelected = order !== -1;
                      return (
                        <li
                          key={`${id}-${card}-${i}`}
                          onClick={() => togglePlay(i)}
                          style={{
                            cursor: "pointer",
                            fontWeight: isSelected ? "bold" : "normal",
                            outline: isSelected
                              ? "2px solid currentColor"
                              : undefined,
                          }}
                        >
                          {card}
                          {isSelected && <span> ({order + 1})</span>}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            );
          })}

          {discardMode !== "DISCARD_OFF" && (
            <button
              type="button"
              disabled={!canDiscard || playSelected.length === 0}
              onClick={async () => {
                const cards = selectedPlayCards();
                const ok = await onDiscard(cards, "PLAY");
                if (ok) setPlaySelected([]);
              }}
            >
              Discard from play
            </button>
          )}
        </section>
      )}

      <h2>Your hand</h2>
      <ul>
        {hand.map((card, i) => {
          const order = selected.indexOf(i);
          const isSelected = order !== -1;

          return (
            <li
              key={`${card}-${i}`}
              onClick={() => toggle(i)}
              style={{
                cursor: "pointer",
                fontWeight: isSelected ? "bold" : "normal",
                outline: isSelected ? "2px solid currentColor" : undefined,
              }}
            >
              {card}
              {isSelected && <span> ({order + 1})</span>}
            </li>
          );
        })}
      </ul>

      <div>
        {discardMode !== "DISCARD_OFF" && (
          <button
            type="button"
            disabled={!canDiscard || selected.length === 0}
            onClick={async () => {
              const cards = selectedCards();
              const ok = await onDiscard(cards, "HAND");
              if (ok) setSelected([]);
            }}
          >
            Discard
          </button>
        )}

        {playMode !== "PLAY_OFF" && (
          <button
            type="button"
            disabled={!canPlay || selected.length === 0}
            onClick={async () => {
              const cards = selectedCards();
              const ok = await onPlay(cards);
              if (ok) setSelected([]);
            }}
          >
            Play
          </button>
        )}
      </div>

      <button onClick={onLeave}>Leave session</button>
    </main>
  );
}
```

---

### `page.tsx` — fix the SessionScreen props

You currently pass `onDiscard` twice plus `onDiscardFromPlay`. Use one:

```tsx
return (
  <SessionScreen
    roster={roster}
    playerId={playerId}
    gameMode={gameMode}
    currentTurn={currentTurn}
    hand={hand}
    remaining={remaining}
    onDraw={drawCard}
    onLeave={leaveSession}
    discardMode={discardMode}
    playMode={playMode}
    playAreas={playAreas}
    topDiscard={topDiscard}
    onDiscard={discardCards}
    onPlay={playCards}
    statusMessage={statusMessage}
  />
);
```

`discardCards` already matches `(cards, source) => Promise<boolean>`, so pass it directly — no wrappers.

---
## me
## Error Type
Console Error

## Error Message
Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.


    at SessionScreen.useEffect (components/SessionScreen.tsx:79:5)

## Code Frame
  77 |
  78 |   useEffect(() => {
> 79 |     setPlaySelected([]);
     |     ^
  80 |   }, [myPlayArea]);
  81 |
  82 |   return (

Next.js version: 16.2.11 (Turbopack)

---
## Cursor
`myPlayArea` is `playAreas[playerId] ?? []`. When that player has no area yet, every render makes a **new** `[]`, so the effect sees a “changed” dep, calls `setPlaySelected`, re-renders, and loops.

**Fix:** depend on the value from state (or a stable empty array), not a fresh `[]`.

```tsx
const myPlayArea = playAreas[playerId]; // string[] | undefined

useEffect(() => {
  setPlaySelected([]);
}, [myPlayArea]); // undefined stays undefined; real arrays only change when playAreas updates
```

Then where you read cards, use:

```tsx
const area = myPlayArea ?? [];
const selectedPlayCards = () => playSelected.map((i) => area[i]);
```

Or keep `myPlayArea` as an array, but stabilize the fallback outside the component:

```tsx
const EMPTY_PLAY: string[] = [];

// inside component:
const myPlayArea = playAreas[playerId] ?? EMPTY_PLAY;
```

Either approach stops the loop. Prefer depending on `playAreas[playerId]` (first option).