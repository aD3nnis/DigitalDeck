## me
how should we seperate the UI into home, lobby, and session

---
## Cursor
You already have the right phase model in state — the split is mostly **structure and gating**, not new domain concepts.

## Three phases

| Phase | Gate | Job |
|--------|------|-----|
| **Home** | `!sessionId` | Create / join / name / mode for create |
| **Lobby** | `sessionId && !gameStarted` | Roster, code, host start, host mode edit, leave |
| **Session (game)** | `sessionId && gameStarted` | Hand, draw, turn, leave |

“Session” is the backend container that spans lobby + play. For UI names, **Lobby** vs **Game** (or “in play”) is clearer than calling the third screen “Session.”

## How to separate it

**First step (recommended):** keep `/` and one owner of WebSocket + REST + state in `app/page.tsx`. Extract presentational screens:

```text
frontend/app/page.tsx              → state, STOMP, REST, pick which screen
frontend/components/HomeScreen.tsx
frontend/components/LobbyScreen.tsx
frontend/components/GameScreen.tsx
```

```tsx
if (!sessionId) return <HomeScreen ... />;
if (!gameStarted) return <LobbyScreen ... />;
return <GameScreen ... />;
```

That also fixes the current bug where create/join still render during lobby/game — home UI should only mount when `!sessionId`.

**Later (optional):** routes when you want shareable URLs:

```text
/                 → Home
/session/[id]     → Lobby or Game (same gate on gameStarted)
```

Refresh already works via `sessionStorage` + rejoin; routes are product polish, not required for the split.

## What each screen owns

- **Home:** local form UI + `onCreate` / `onJoin` (no STOMP).
- **Lobby:** roster, code, host Start, host mode PATCH / guests read-only mode, Leave.
- **Game:** turn/hand/draw/remaining, Leave. No mode radios.

Keep networking in the parent (or a hook later). Screens get props and callbacks only.

## Mapping from today

Your backend already matches this: no session → home; session without deck → lobby; deck exists (`gameStarted`) → game. Events like `GAME_STATE`, `DECK_INITIALIZED`, and leave clearing `sessionId` are the transitions.

So: extract the three screens under `components/`, gate exclusively on `sessionId` + `gameStarted`, leave routing for later. Switch to Agent mode if you want that refactor applied.