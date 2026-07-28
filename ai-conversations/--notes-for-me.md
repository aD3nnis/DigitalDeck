##TESTING COMMANDS
access redis-cli: 
`docker exec -it digital-deck-redis redis-cli`

check number of seconds left before session key auto-expires
access redis-cli + `TTL session:<sessionId>:meta`



get session id: 
`curl http://localhost:8080/api/sessions/{code}`

Bypass the UI entirely — curl a draw for the wrong player
curl -X POST http://localhost:8080/api/sessions/<sessionId>/draw \
  -H "Content-Type: application/json" \
  -d '{"playerId": "not-a-real-player"}'


## Java stale in project
Command Palette (Cmd+Shift+P):

Java: Clean Java Language Server Workspace — then reload when prompted


## Claude vs Cursor disagreement
Across this refresh thread, the split looks like this:

### Where they disagreed (identity / reconnect wiring)
- **Claude:** Treat refresh as a sync-identity problem. Use lazy `useState(() => …)` for `playerId` (and `displayName`) so the first render already has the right values; keep the existing `onConnect` rejoin as-is; don’t add gating or extra join args.
- **Cursor:** After the SSR crash, move identity into a `useEffect` (async, starts `null`). That creates a race with STOMP `onConnect`, so patch around it: gate the socket until `playerId` exists, and/or pass `playerId` / `savedName` into `subscribeAndJoin`.
- **Claude’s critique of Cursor:** Those patches work around a race that only exists because identity was made async; prefer fixing the root (lazy init) over belt-and-suspenders reconnect logic.
- **Cursor’s caveat on Claude:** Pure lazy init without a `typeof window` guard crashes under Next SSR; gating is still a reasonable invariant if more identity-dependent code piles up later.

### Where they agreed (what “survive a refresh” means on the client)
- Persist identity in **`sessionStorage`** (survives refresh, clears when the tab closes).
- Persist **`sessionId` + `displayName`**, clear them on explicit leave.
- On reconnect, **rejoin with the existing join message** (idempotent `addPlayer`).
- Add a **hand fetch** endpoint so cards come back from Redis.

### Where they align on the turn-skip bug (server)
- **Both (same diagnosis):** Refresh already restores UI/hand; the draw/turn bug is because `WebSocketEventListener` treats every socket drop as an immediate leave + turn advance — and a refresh *is* a socket drop.
- **Shared fix shape:** A **grace period** — delay leave/turn-skip on disconnect; cancel if the same `playerId` rejoins in time; run today’s leave logic if the timer fires; keep **Leave** as immediate.

### One-line summary
- **Claude:** Fix refresh by making client identity correct *synchronously*, then rejoin.
- **Cursor:** Also make reconnect structurally safe against null/stale identity (gate / pass args), especially after the SSR-driven `useEffect` change.
- **Both on turns:** Don’t change “refresh vs disconnect” on the client — delay the server’s disconnect leave so a quick reconnect doesn’t skip your turn.
  



### Note for refresh 
playerId is briefly an empty string during any server-render pass before hydration. That's invisible in normal browser use (you never see the server-rendered HTML directly interact with anything), so it shouldn't cause a visible bug — just worth knowing it's there if you ever see a flash of "wrong" initial state before hydration settles.