## me
The logic for my game is messed up probably with my last commit of adding refresh mechanics. When i have two tabs i want the logic to be both people can join the same session. But now when that happens it does not add a new player it just underwrites the second player making the session have a seperate name but a single ID being the first players ID
---
## Cursor
The overwrite is coming from **both tabs joining as the same `playerId`**, not from broken roster broadcast logic.

## What’s happening

Backend join is keyed by `playerId`:

```62:71:backend/src/main/java/com/ava/digitaldeck/services/SessionService.java
    public void addPlayer(String sessionId, String playerId, String displayName) {
        String playersKey = "session:" + sessionId + ":players";
        redisTemplate.opsForHash().put(playersKey, playerId, displayName);
        // ...
        Long existingIndex = redisTemplate.opsForList().indexOf(orderKey, playerId);
        if (existingIndex == null) {
            redisTemplate.opsForList().rightPush(orderKey, playerId);
        }
```

`HPUT` overwrites the name for that ID, and if the ID is already in `playerOrder` it does **not** append again. That was intentional for refresh/rejoin, so reconnecting doesn’t duplicate you.

Your refresh commit switched identity from “new UUID every mount” to “persist in `sessionStorage`”:

```25:32:frontend/app/page.tsx
  const [playerId] = useState(() => {
    if (typeof window === "undefined") return "";
    const stored = sessionStorage.getItem("digitalDeck.playerId");
    if (stored) return stored;
    const newId = crypto.randomUUID();
    sessionStorage.setItem("digitalDeck.playerId", newId);
    return newId;
  });
```

So if both tabs send the same `playerId` with different display names, you get exactly what you’re seeing: **one ID, name replaced by the second join**.

## Why two tabs share an ID

`sessionStorage` is per-tab for a **fresh** tab, but **duplicating a tab copies `sessionStorage`**. Chrome/Safari/Firefox all do this.

Typical repro:

1. Tab A creates/joins → stores `playerId`, `sessionId`, `displayName`
2. Duplicate Tab A (or restore that window)
3. Tab B inherits the same `playerId` (and often auto-rejoins via `onConnect`)
4. Change the name in Tab B and join again → Redis overwrites that one hash field

Before the refresh commit, each mount always got `crypto.randomUUID()`, so duplicate tabs still looked like two players.

## How to confirm

In each tab’s DevTools → Application → Session Storage, check `digitalDeck.playerId`. If they’re identical, that’s the bug. Roster will keep one entry; only the name changes.

## What to do

**For testing now:** open a **new** tab to the app (type the URL / new window), or use a normal window + an Incognito window. Don’t use Duplicate Tab. Two independent `sessionStorage`s → two IDs → two roster entries.

**For a real fix (when you’re ready to change code):** keep `sessionStorage` for refresh-in-the-same-tab, but decide how “second person in another tab” should work, e.g.:

- Document that multi-player testing needs a fresh tab / second browser profile
- Or regenerate `playerId` when this tab is clearly a different person joining (harder to detect)
- Or stop treating “same `playerId` + new name” as silent overwrite and surface it as rejoin vs new player

The disconnect-grace / rejoin path is doing what it was designed to do; the collision is **shared identity across tabs**, not host/turn logic itself.

I’m in Ask mode so I can’t patch it here — switch to Agent mode if you want a concrete identity fix implemented.

---
## me
give me the code changes you would make in ask mode

---
## Cursor
No backend changes — idempotent `addPlayer` is correct. Fix identity in `frontend/app/page.tsx`.

## Approach

Use navigation type to tell **refresh** apart from **new/duplicated tab**:

- `reload` → keep `playerId` + session (refresh forgiveness)
- anything else (`navigate`, including Duplicate Tab) → mint a new `playerId` and drop inherited session keys so you don’t auto-rejoin as the other tab

## Replace the `playerId` / `displayName` init

```tsx
const [displayName, setDisplayName] = useState("");
const [playerId, setPlayerId] = useState("");

useEffect(() => {
  const nav = performance.getEntriesByType(
    "navigation"
  )[0] as PerformanceNavigationTiming | undefined;
  const isReload = nav?.type === "reload";

  let id = sessionStorage.getItem("digitalDeck.playerId");

  if (!isReload || !id) {
    // Fresh tab OR duplicated tab (copies sessionStorage but is not a reload)
    id = crypto.randomUUID();
    sessionStorage.setItem("digitalDeck.playerId", id);
    sessionStorage.removeItem("digitalDeck.sessionId");
    sessionStorage.removeItem("digitalDeck.displayName");
    setDisplayName("");
  } else {
    setDisplayName(sessionStorage.getItem("digitalDeck.displayName") ?? "");
  }

  setPlayerId(id);

  const stompClient = new Client({
    brokerURL: "ws://localhost:8080/ws",
    onConnect: () => {
      setClient(stompClient);

      const savedSessionId = sessionStorage.getItem("digitalDeck.sessionId");
      const savedName = sessionStorage.getItem("digitalDeck.displayName");
      // Only auto-rejoin after a real refresh (keys survived the branch above)
      if (savedSessionId && savedName) {
        setDisplayName(savedName);
        setSessionId(savedSessionId);
        subscribeAndJoin(savedSessionId, stompClient, id, savedName);
        rehydrateHand(savedSessionId, id);
      }
    },
  });

  stompClient.activate();
  return () => {
    stompClient.deactivate();
  };
}, []);
```

Important: init identity **before** connecting, and pass `id` / name into join/rehydrate so you don’t close over empty React state on first connect.

## Update helpers to take explicit ids

`subscribeAndJoin` / `rehydrateHand` currently close over `playerId` / `displayName`, which are wrong inside the connect effect. Thread them through:

```tsx
const subscribeAndJoin = (
  resolvedSessionId: string,
  stompClient: Client,
  joinPlayerId: string = playerId,
  joinDisplayName: string = displayName,
) => {
  if (sessionId === resolvedSessionId) return;

  stompClient.subscribe(`/topic/session/${resolvedSessionId}`, (message) => {
    // ... unchanged handlers ...
  });

  stompClient.publish({
    destination: `/app/session/${resolvedSessionId}/join`,
    body: JSON.stringify({
      playerId: joinPlayerId,
      displayName: joinDisplayName,
    }),
  });
};

const rehydrateHand = async (
  resolvedSessionId: string,
  handPlayerId: string = playerId,
) => {
  const res = await fetch(
    `http://localhost:8080/api/sessions/${resolvedSessionId}/hand?playerId=${handPlayerId}`,
  );
  if (!res.ok) return;
  const { hand: savedHand } = await res.json();
  setHand(savedHand);
};
```

`createAndJoin` / `joinExisting` can keep calling `subscribeAndJoin(resolvedId, client)` and use the defaults.

## What you should see after

| Action | Result |
|---|---|
| Refresh Tab A | Same `playerId`, auto-rejoin, hand restored |
| Duplicate Tab A | New `playerId`, lobby cleared — join with code as player 2 |
| New tab to URL | New `playerId`, empty lobby |

Backend stays as-is. Switch to Agent mode if you want this applied for you.