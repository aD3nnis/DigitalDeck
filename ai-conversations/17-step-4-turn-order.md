## me
lets do the turn order

---
## Claude
Turn order needs one more piece of state: an ordered list of players (so we know who's "next"), plus a pointer to whose turn it currently is. Let's build that as its own service, since it's a distinct concern from deck mechanics.

**Track join order — a small addition to `SessionService`**

```java
public void addPlayer(String sessionId, String playerId, String displayName) {
    String playersKey = "session:" + sessionId + ":players";
    redisTemplate.opsForHash().put(playersKey, playerId, displayName);
    redisTemplate.expire(playersKey, SESSION_TTL);

    String orderKey = "session:" + sessionId + ":playerOrder";
    Long existingIndex = redisTemplate.opsForList().indexOf(orderKey, playerId);
    if (existingIndex == null) {
        redisTemplate.opsForList().rightPush(orderKey, playerId);
    }
    redisTemplate.expire(orderKey, SESSION_TTL);
}

public void removePlayer(String sessionId, String playerId) {
    redisTemplate.opsForHash().delete("session:" + sessionId + ":players", playerId);
    redisTemplate.opsForList().remove("session:" + sessionId + ":playerOrder", 0, playerId);
}
```

Why a separate list rather than just using the players hash: Redis hashes don't give you a guaranteed, reliable ordering to build turn sequence on — a plain list, appended to in join order, is the explicit and dependable source of truth for "who goes in what order." The `indexOf` check on join guards against double-counting if a player somehow joins twice.

**`service/TurnService.java`**

```java
package com.ava.digitaldeck.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

@Service
public class TurnService {

    private static final Duration SESSION_TTL = Duration.ofHours(4);

    private final StringRedisTemplate redisTemplate;

    @Autowired
    public TurnService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void startTurns(String sessionId) {
        redisTemplate.opsForValue().set("session:" + sessionId + ":turnIndex", "0", SESSION_TTL);
    }

    public Optional<String> getCurrentPlayer(String sessionId) {
        List<String> order = redisTemplate.opsForList().range("session:" + sessionId + ":playerOrder", 0, -1);
        if (order == null || order.isEmpty()) return Optional.empty();

        String indexStr = redisTemplate.opsForValue().get("session:" + sessionId + ":turnIndex");
        int index = (indexStr == null ? 0 : Integer.parseInt(indexStr)) % order.size();
        return Optional.of(order.get(index));
    }

    public Optional<String> advanceTurn(String sessionId) {
        List<String> order = redisTemplate.opsForList().range("session:" + sessionId + ":playerOrder", 0, -1);
        if (order == null || order.isEmpty()) return Optional.empty();

        String turnIndexKey = "session:" + sessionId + ":turnIndex";
        String indexStr = redisTemplate.opsForValue().get(turnIndexKey);
        int nextIndex = ((indexStr == null ? 0 : Integer.parseInt(indexStr)) + 1) % order.size();

        redisTemplate.opsForValue().set(turnIndexKey, String.valueOf(nextIndex), SESSION_TTL);
        return Optional.of(order.get(nextIndex));
    }
}
```

The `% order.size()` (modulo) is what makes turns wrap around — after the last player, index 0 comes back up again. Storing just an *index* rather than a playerId directly means turn order survives even if you later change how players are represented — the index is purely positional.

**Wire it into `SessionController`** — inject `TurnService`, then update both endpoints:

```java
@PostMapping("/{sessionId}/deck/init")
public ResponseEntity<?> initDeck(@PathVariable String sessionId) {
    if (!sessionService.sessionExists(sessionId)) return ResponseEntity.notFound().build();

    deckService.initializeDeck(sessionId);
    turnService.startTurns(sessionId);
    String currentPlayer = turnService.getCurrentPlayer(sessionId).orElse(null);

    messagingTemplate.convertAndSend("/topic/session/" + sessionId,
            new SessionEvent("DECK_INITIALIZED", sessionId, Map.of("remaining", deckService.remainingCount(sessionId))));
    messagingTemplate.convertAndSend("/topic/session/" + sessionId,
            new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", currentPlayer)));

    return ResponseEntity.ok(Map.of("remaining", deckService.remainingCount(sessionId), "currentTurn", currentPlayer));
}

@PostMapping("/{sessionId}/draw")
public ResponseEntity<?> draw(@PathVariable String sessionId, @RequestBody DrawRequest request) {
    if (!sessionService.sessionExists(sessionId)) return ResponseEntity.notFound().build();

    Optional<String> currentPlayer = turnService.getCurrentPlayer(sessionId);
    if (currentPlayer.isEmpty() || !currentPlayer.get().equals(request.playerId())) {
        return ResponseEntity.status(403).body(Map.of("error", "not your turn"));
    }

    Optional<String> card = deckService.drawCard(sessionId, request.playerId());
    if (card.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "deck is empty"));

    String nextPlayer = turnService.advanceTurn(sessionId).orElse(null);

    messagingTemplate.convertAndSend("/topic/session/" + sessionId,
            new SessionEvent("CARD_DRAWN", sessionId, Map.of("playerId", request.playerId(), "remaining", deckService.remainingCount(sessionId))));
    messagingTemplate.convertAndSend("/topic/session/" + sessionId,
            new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", nextPlayer)));

    return ResponseEntity.ok(Map.of("card", card.get()));
}
```

The `403` status on an out-of-turn draw attempt is a deliberate choice — it's the HTTP code for "I understood you, but you're not allowed," distinct from a 404 (doesn't exist) or 400 (malformed request). The rest of the flow follows your established draw pattern exactly: private response to the caller, public broadcast without the card, now with a second broadcast telling everyone whose turn it is next.

**Testing via curl** — join two test players into the same session, `POST .../deck/init`, then try drawing as the *wrong* player first (should get the 403), then as the correct one (should succeed and hand off to the next player in join order).

One real gap worth naming now rather than discovering later: if it's currently a player's turn and they disconnect or leave, nothing currently skips past them — the game would just stall, waiting on someone who's gone. That's a natural follow-up (advance the turn automatically if the current player leaves), similar in spirit to the disconnect-cleanup work you already did for the roster. Want to handle that now, or move to wiring the draw/turn UI into the frontend and come back to this edge case later?

---
## me
no lets work on that edge case now.

---
## Claude
This edge case exposes a real bug in the turn design, not just a missing feature — worth walking through why before the fix.

**The problem with what you have**: `TurnService` currently tracks turns by storing a numeric *index* into the `playerOrder` list. That works fine as long as the list never changes. But when a player leaves, `removePlayer` does `LREM` on that list — and Redis lists shift positions when you remove from the middle. If player at index 1 leaves, everyone after them shifts down one slot, so your stored index now points at a *different player* than the one it meant to. Turn order would silently corrupt itself — not crash, just quietly hand turns to the wrong people.

The fix: track the **current player's ID directly**, not a positional index. Then "who's next" gets computed fresh by looking up that ID's *current* position in the list, whenever it's needed — never trusting a stored number to still mean the same thing after the list changes underneath it.

**Rewritten `TurnService.java`** (replaces the index-based version entirely):

```java
package com.ava.digitaldeck.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

@Service
public class TurnService {

    private static final Duration SESSION_TTL = Duration.ofHours(4);
    private final StringRedisTemplate redisTemplate;

    @Autowired
    public TurnService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void startTurns(String sessionId) {
        List<String> order = redisTemplate.opsForList().range(orderKey(sessionId), 0, -1);
        if (order != null && !order.isEmpty()) {
            redisTemplate.opsForValue().set(currentKey(sessionId), order.get(0), SESSION_TTL);
        }
    }

    public Optional<String> getCurrentPlayer(String sessionId) {
        return Optional.ofNullable(redisTemplate.opsForValue().get(currentKey(sessionId)));
    }

    public Optional<String> advanceTurn(String sessionId) {
        List<String> order = redisTemplate.opsForList().range(orderKey(sessionId), 0, -1);
        if (order == null || order.isEmpty()) return Optional.empty();

        String current = redisTemplate.opsForValue().get(currentKey(sessionId));
        int idx = current == null ? -1 : order.indexOf(current);
        String next = order.get((idx + 1) % order.size());

        redisTemplate.opsForValue().set(currentKey(sessionId), next, SESSION_TTL);
        return Optional.of(next);
    }

    /** Call this BEFORE removing the player from playerOrder. */
    public Optional<String> handlePlayerLeft(String sessionId, String playerId) {
        String current = redisTemplate.opsForValue().get(currentKey(sessionId));
        if (current == null || !current.equals(playerId)) {
            return Optional.ofNullable(current); // wasn't their turn — nothing to do
        }

        List<String> order = redisTemplate.opsForList().range(orderKey(sessionId), 0, -1);
        if (order == null || order.isEmpty()) {
            redisTemplate.delete(currentKey(sessionId));
            return Optional.empty();
        }

        int idx = order.indexOf(playerId);
        for (int i = 1; i <= order.size(); i++) {
            String candidate = order.get((idx + i) % order.size());
            if (!candidate.equals(playerId)) {
                redisTemplate.opsForValue().set(currentKey(sessionId), candidate, SESSION_TTL);
                return Optional.of(candidate);
            }
        }

        redisTemplate.delete(currentKey(sessionId)); // everyone left
        return Optional.empty();
    }

    private String currentKey(String sessionId) { return "session:" + sessionId + ":currentTurnPlayer"; }
    private String orderKey(String sessionId) { return "session:" + sessionId + ":playerOrder"; }
}
```

The critical ordering note in that doc comment: `handlePlayerLeft` needs the order list to **still contain** the departing player when it runs, so it can find their old position and search forward from there. That means your leave and disconnect handlers need to call this *before* `sessionService.removePlayer`, not after.

**Update the leave handler in `SessionSocketController`:**

```java
@MessageMapping("/session/{sessionId}/leave")
public void leave(@DestinationVariable String sessionId, LeaveRequest request) {
    if (!sessionService.sessionExists(sessionId)) return;

    String nextPlayer = turnService.handlePlayerLeft(sessionId, request.playerId()).orElse(null);
    sessionService.removePlayer(sessionId, request.playerId());

    // existing PLAYER_LEFT broadcast...
    // existing ROSTER broadcast...

    messagingTemplate.convertAndSend("/topic/session/" + sessionId,
            new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", nextPlayer)));
}
```

**Same change in `WebSocketEventListener.handleDisconnect`** — identical adjustment: call `turnService.handlePlayerLeft(...)` before `sessionService.removePlayer(...)`, then add the `TURN_CHANGED` broadcast alongside the existing `PLAYER_LEFT`/`ROSTER` ones.

One deliberate simplification here: both handlers now broadcast `TURN_CHANGED` unconditionally on every leave, even when the departing player wasn't holding the turn — in that case it just rebroadcasts the same current player, which is a harmless no-op for anyone watching. Not worth adding a conditional check to avoid a redundant message at this scale.

**Test it**: three tabs join a session, init the deck. Have the player *currently holding the turn* leave (not just any player) — every remaining tab's turn indicator should immediately move to whoever's next, skipping the departed player cleanly, no stall.

---
## me
this is the full code currently in my sessionsocketcontroller. do i need the rosterEvent object because it is saying it is not currently used: 

---
## Claude
You're right that `rosterEvent` is unused in `leave` — it's declared but the actual `messagingTemplate.convertAndSend` call for it never happens; you overwrote the intended broadcast slot with the `TURN_CHANGED` send instead. That's a leftover from wiring the turn logic in, not a sign you don't need the roster update at all.

You actually want **three** broadcasts in `leave`, matching the pattern from your `join` handler: the leave notification, the refreshed roster (so everyone's player list actually drops the person who left), and now the turn change. Right now roster update is silently missing — which means if you tested this, you'd have seen `PLAYER_LEFT` fire but the visible roster list never actually shrink.

Fixed version:

```java
@MessageMapping("/session/{sessionId}/leave")
public void leave(@DestinationVariable String sessionId, LeaveRequest request) {
    if (!sessionService.sessionExists(sessionId)) return;

    String nextPlayer = turnService.handlePlayerLeft(sessionId, request.playerId()).orElse(null);
    sessionService.removePlayer(sessionId, request.playerId());

    SessionEvent leaveEvent = new SessionEvent(
            "PLAYER_LEFT",
            sessionId,
            Map.of("playerId", request.playerId())
    );
    messagingTemplate.convertAndSend("/topic/session/" + sessionId, leaveEvent);

    SessionEvent rosterEvent = new SessionEvent(
            "ROSTER",
            sessionId,
            sessionService.getPlayers(sessionId)
    );
    messagingTemplate.convertAndSend("/topic/session/" + sessionId, rosterEvent);

    messagingTemplate.convertAndSend("/topic/session/" + sessionId,
            new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", nextPlayer)));
}
```

Same fix applies to `WebSocketEventListener.handleDisconnect` if it has the same shape — worth a quick check there too, since it was built by copying this same leave pattern.

Good catch running into this via the compiler warning rather than just silencing it — "unused variable" warnings are usually pointing at exactly this kind of thing: not dead code to delete, but a call that got dropped by accident.

--- 
## me
i made the update to websocketeventlistener.handleDisconnect, is this correct?

---
## Claude
Close, but there's a bug — `sessionId` and `request.playerId()` don't exist in this method's scope. This handler works with a `connection` object, not a `request`, so that line won't compile.

Fix:

```java
String nextPlayer = turnService.handlePlayerLeft(connection.sessionId(), connection.playerId()).orElse(null);
```

Same values as everywhere else in this method — `connection.sessionId()` and `connection.playerId()` — since that's what got recovered from `connectionRegistry.remove(...)` a few lines above. It's an easy slip to make, likely from copying the pattern out of `leave()` where the equivalent values came from a `request` object instead.

Everything else in what you wrote is correctly ordered and structured — `handlePlayerLeft` runs before `removePlayer` (matching the requirement from `TurnService`'s doc comment), and all three broadcasts (`PLAYER_LEFT`, `ROSTER`, `TURN_CHANGED`) are present and in a sensible sequence.

Corrected line in context:

```java
ConnectionRegistry.PlayerConnection connection = connectionRegistry.remove(webSocketSessionId);
if (connection == null) {
    return;
}

String nextPlayer = turnService.handlePlayerLeft(connection.sessionId(), connection.playerId()).orElse(null);

sessionService.removePlayer(connection.sessionId(), connection.playerId());
// ...rest unchanged
```

Swap that one line in and it should compile cleanly.

---
## me
ok so how do i test for these changes?

---
## Claude
This edge case needs multiple players and a way to control *whose* turn it is when someone leaves — a bit more setup than your earlier tests, since you need to specifically catch the turn-holder leaving, not just anyone.

**Setup: three tabs, real turn order**

1. Open three browser tabs, each joining the **same session** with different names (Tab A, B, C) — same create/join flow you already have working.
2. `POST /api/sessions/{sessionId}/deck/init` via curl — this should now also broadcast `TURN_CHANGED`, so watch your message list in all three tabs; whichever player joined first should be named as current turn.

**Test 1: the departing player is NOT holding the turn**

3. Have whichever tab is *not* current turn click "Leave session" (or just close that tab).
4. Expected: `PLAYER_LEFT` and `ROSTER` update normally, and `TURN_CHANGED` fires but names the *same* player as before — nothing about turn order should actually change, since the person who left wasn't holding it.

**Test 2: the departing player IS holding the turn — the actual edge case**

5. Reset (create a fresh session, or re-init the deck) so you know exactly who has the turn again.
6. This time, have the **current turn-holder** specifically close their tab (to test the disconnect path — not the leave button, since that exercises `WebSocketEventListener` rather than the explicit `leave` handler).
7. Expected: the remaining tabs should see the roster drop that player, *and* `TURN_CHANGED` should name whoever's next in the original join order — skipping cleanly past the person who left, no stall.

**Test 3: explicit leave, same scenario**

8. Repeat step 6-7, but this time have the turn-holder click "Leave session" instead of closing the tab — confirms the same fix works through both code paths (`leave()` and `handleDisconnect()`), since they're separate methods that both needed the fix.

**Verifying via Redis directly, if the UI update isn't convincing enough on its own:**

```bash
docker exec -it digital-deck-redis redis-cli
GET session:<sessionId>:currentTurnPlayer
```

Run this before and after the turn-holder leaves — the value should change to a *different* playerId, confirming the backend state itself updated, not just what got broadcast.

**One thing to watch for specifically**: since you're using an in-memory `Random` shuffle and this is about *order*, not randomness, the actual card values don't matter here — focus entirely on whether `currentTurnPlayer` correctly skips the departed player and lands on someone still in the session.

If you have three tabs open and can't remember who's "current" at a glance, it might be worth pausing here to add a simple "It's your turn" / "Waiting for X" indicator to the frontend — not required for this test, but it'll make every turn-order test from here on much easier to eyeball rather than cross-referencing IDs in a message log.

---
## me
where would i find turn_changed?
---
## Claude
`TURN_CHANGED` isn't a file or a UI element you navigate to — it's just the `type` field on one of the WebSocket messages arriving in whatever list you're rendering `messages` into on your frontend (the same `<ul>` you built way back for the join test, if you haven't since replaced it with something nicer).

Since your `subscribe` handler currently only special-cases `ROSTER` messages (parsing them into the `roster` state) and dumps everything else as raw JSON strings into `messages`, a `TURN_CHANGED` event will show up in that same message list looking like:

```
{"type":"TURN_CHANGED","sessionId":"...","payload":{"playerId":"<uuid>"},"timestamp":"..."}
```

So to actually see it: watch that message list in your browser tab right after you call `deck/init` or `draw` — it'll be sitting there as one of the raw entries, not broken out separately.

If that's hard to spot buried in a growing list of raw JSON, this is a good moment to add explicit handling for it in your subscribe callback, the same way you did for `ROSTER`:

```tsx
stompClient.subscribe(`/topic/session/${resolvedSessionId}`, (message) => {
  const event = JSON.parse(message.body);
  if (event.type === "ROSTER") {
    setRoster(event.payload);
  } else if (event.type === "TURN_CHANGED") {
    setCurrentTurn(event.payload.playerId);
  } else {
    setMessages((prev) => [...prev, message.body]);
  }
});
```

With a new `const [currentTurn, setCurrentTurn] = useState<string | null>(null);` and something in your JSX like:

```tsx
<p>Current turn: {roster[currentTurn ?? ""] ?? "—"}</p>
```

That last line reuses your existing `roster` map to turn the raw `playerId` into an actual display name — much easier to eyeball during testing than comparing UUIDs by hand, which ties back to the "It's your turn" indicator I mentioned as worth adding before your next round of testing.
---
## me
i think it was just never added this is what i currently have in there: 

```typescriptreact
"use client";

import { useEffect, useState } from "react";
import { Client } from "@stomp/stompjs";

export default function Home() {
  const [messages, setMessages] = useState<string[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [roster, setRoster] = useState<Record<string, string>>({});
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const stompClient = new Client({
      brokerURL: "ws://localhost:8080/ws",
      onConnect: () => {
        setClient(stompClient);
      },
    });

    stompClient.activate();

    return () => {
      stompClient.deactivate();
    };
  }, []);

  const [playerId] = useState(() => crypto.randomUUID()); // once per tab, not per click

  const subscribeAndJoin = (resolvedSessionId: string, stompClient: Client) => {
    if (sessionId === resolvedSessionId) return; // already in this session, don't resubscribe
  
  stompClient.subscribe(`/topic/session/${resolvedSessionId}`, (message) => {
    const event = JSON.parse(message.body);
    if (event.type === "ROSTER") {
      setRoster(event.payload); // { playerId: displayName, ... }
    } else {
      setMessages((prev) => [...prev, message.body]);
    }
  });
    stompClient.publish({
      destination: `/app/session/${resolvedSessionId}/join`,
      body: JSON.stringify({ playerId, displayName }),
    });
  };

  const createAndJoin = async () => {
    if (!client) return;

    const createRes = await fetch("http://localhost:8080/api/sessions", {
      method: "POST",
    });
    const { code: newCode } = await createRes.json();
    setCode(newCode);

    const resolveRes = await fetch(
      `http://localhost:8080/api/sessions/${newCode}`
    );
    const { sessionId: resolvedId } = await resolveRes.json();
    setSessionId(resolvedId);

    subscribeAndJoin(resolvedId, client);
  };

  const joinExisting = async () => {
    if (!client || !joinCodeInput) return;

    const resolveRes = await fetch(
      `http://localhost:8080/api/sessions/${joinCodeInput}`
    );
    if (!resolveRes.ok) {
      alert("Session not found");
      return;
    }
    const { sessionId: resolvedId } = await resolveRes.json();
    setSessionId(resolvedId);

    subscribeAndJoin(resolvedId, client);
  };

  const leaveSession = () => {
    if (!client || !sessionId) return;
  
    client.publish({
      destination: `/app/session/${sessionId}/leave`,
      body: JSON.stringify({ playerId }),
    });
  
    setSessionId(null);
    setRoster({});
    setMessages([]);
  };

  return (
    <main>
      <section>
        <button onClick={createAndJoin} disabled={!client}>
          Create &amp; join session
        </button>
        {code && <p>Session code: {code}</p>}
      </section>

      <section>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
        />
        <input
          value={joinCodeInput}
          onChange={(e) => setJoinCodeInput(e.target.value)}
          placeholder="Enter code"
        />
        <button onClick={joinExisting} disabled={!client}>
          Join session
        </button>
      </section>
      <h2>Players in session</h2>
      <ul>
        {Object.entries(roster).map(([playerId, displayName]) => (
          <li key={playerId}>
            {displayName} <small>({playerId})</small>
          </li>
        ))}
      </ul>
      {sessionId && (
        <button onClick={leaveSession}>Leave session</button>
      )}
    </main>
  );
}
```

---
## Claude
Right — looking at your actual file, the `subscribeAndJoin` handler only special-cases `ROSTER`; everything else, including `TURN_CHANGED`, falls into the generic `messages` bucket as raw JSON. Let's add explicit handling for it.

**Add a new state variable**, alongside your others:

```tsx
const [currentTurn, setCurrentTurn] = useState<string | null>(null);
```

**Update the subscribe handler** inside `subscribeAndJoin`:

```tsx
stompClient.subscribe(`/topic/session/${resolvedSessionId}`, (message) => {
  const event = JSON.parse(message.body);
  if (event.type === "ROSTER") {
    setRoster(event.payload);
  } else if (event.type === "TURN_CHANGED") {
    setCurrentTurn(event.payload.playerId);
  } else {
    setMessages((prev) => [...prev, message.body]);
  }
});
```

**Add a display line** in your JSX, right after the roster list — this resolves the raw `playerId` back to a name using the roster map you already have:

```tsx
<p>Current turn: {currentTurn ? roster[currentTurn] ?? currentTurn : "—"}</p>
```

The `?? currentTurn` fallback matters for one specific moment: right when `TURN_CHANGED` first arrives, there's a brief instant where `currentTurn` might reference a playerId whose name hasn't landed in `roster` yet, depending on message arrival order. Falling back to the raw ID rather than showing nothing avoids a confusing blank in that gap — you'll see the UUID flash briefly instead of a name, which is a fine tradeoff for a debug view like this.

One more thing worth doing while you're testing turn order specifically: also highlight when it's *this tab's own* turn, since eyeballing "does this UUID match my UUID" across three tabs is exactly the kind of thing that's easy to mis-read mid-test:

```tsx
<p>
  Current turn: {currentTurn ? roster[currentTurn] ?? currentTurn : "—"}
  {currentTurn === playerId && " (this is you!)"}
</p>
```

That'll make the leave/disconnect turn-skip tests from before much easier to visually confirm — you can watch "(this is you!)" jump from tab to tab as turns advance, and specifically watch it correctly skip over whichever tab you close or leave from.
