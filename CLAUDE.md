# DigitalDeck — Claude Code guide

Multiplayer shared card deck: Spring Boot + Redis backend, Next.js client, STOMP over WebSocket for live sync.
We are in **Phase 2** (see README "Project phases"). v1 is done when the Phase 2 scope is done.

## How we work in Phase 2

- Ava owns requirements, interfaces (signatures + interface comments), and tests. Claude implements behind them.
- Before a non-trivial change, propose 2–3 genuinely different designs with trade-offs and wait for Ava to pick.
- After a feature works, say what you would restructure now that it exists, before starting the next thing.
- Commits use Ava's git identity only. No `Co-Authored-By: Claude` trailer. Don't push; Ava pushes.

## Non-negotiables

- **The server is authoritative.** Clients never hold, compute, or validate game state. Game rules never go in the frontend.
- **All live game state lives in Redis.** PostgreSQL is wired up but not used for game data.
- **Every player action's permission, and whether it advances the turn, goes through `TurnActionPolicy`**, which returns `Permit.Allowed(advanceTurnAfter)` or `Permit.Denied(error)`. No turn or mode checks in controllers.
- **Transport:** game actions and lobby settings are REST calls; join and leave are STOMP messages (`/app/session/{sessionId}/join`, `/leave`). The server broadcasts every resulting change on `/topic/session/{sessionId}`.

## Map of the code

- `backend/src/main/java/com/ava/digitaldeck/`
  - `controllers/` — `SessionController` (REST), `SessionSocketController` (STOMP join/leave)
  - `services/` — `DeckService` (deck, hands, discard, play/dealer areas, reshuffle), `TurnService`, `TurnActionPolicy`, `SessionService` (sessions, roster, codes, modes), `LobbySettingsService`, `GameStartService`, `DisconnectGraceService`, `ConnectionRegistry`
  - `model/` — request records and the `GameMode` / `DiscardMode` / `PlayMode` enums
  - `config/` — WebSocket config and the disconnect listener
- `frontend/app/page.tsx` — session state, STOMP client, identity in `sessionStorage`
- `frontend/components/` — `GameTable`, `tableLayouts.ts` (seating), play boards, piles, hand
- `scripts/` — SVG transform helpers; not part of the app runtime

## Contracts and conventions

- **Redis keys:** `session:{sessionId}:{field}` (e.g. `deck`, `discard`, `hands:{playerId}`, `gameMode`, `currentTurnPlayer`, `meta`); `code:{CODE}` → sessionId. Session keys share a TTL.
- **STOMP events:** `SCREAMING_SNAKE` names (`PLAYER_JOINED`, `CARD_DRAWN`, `CARDS_PLAYED`, `TURN_CHANGED`, …).
- **Seating:** every viewer sits at `bottom`; other players go clockwise in turn order (`RING` / `screenPlayersBySeat` in `tableLayouts.ts`).
- **Reference examples to copy:** the `/draw` endpoint in `SessionController` for a player action, and `TurnActionPolicyTest` for testing behavior at an interface. (Provisional; both get tidied in Phase 2 groundwork.)

## Don'ts

- Don't add per-seat components or per-player-count CSS files. Seat differences should be data, not new components.
- Don't add try/catch, null checks, or fallbacks for cases that can't happen. Ask whether the error can be designed out.
- Don't fix a bug with a special case or an extra flag. Say what the design would look like if it had been built with the requirement in mind, and propose that.
- Don't write tests that pin implementation details. Test behavior at the interface.

## Known debt (don't copy it; fix it when you're working there)

- Six near-duplicate `Plyr*PlayBoard` components with hardcoded SVG paths.
- `SessionController` repeats the permit → unwrap → payload → broadcast sequence in each action endpoint.
- `page.tsx` holds ~30 pieces of state plus all STOMP wiring.
- The shared `SlotId` type is exported from `Plyr1PlayBoard` instead of `types.ts`.
- Redis key strings are built inline across several services instead of in one place.

## Verify your work

```bash
docker compose up -d                       # Postgres + Redis
cd backend && ./mvnw test                  # backend tests
cd backend && ./mvnw spring-boot:run       # API :8080, WS /ws
cd frontend && npm run dev                 # UI :3000
```

Frontend is Next.js 16; read `node_modules/next/dist/docs/` before using Next APIs (see `frontend/AGENTS.md`).

## Where decisions came from

`ai-conversations/` is the Phase 1 decision log (#1–#92). The README tells the project story. Check them before reversing an established decision.
