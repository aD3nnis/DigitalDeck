# DigitalDeck

A full-stack multiplayer app that simulates a shared physical card deck online. Players create or join a session with a short code, then draw, discard, and play from a server-authoritative deck in real time — so no client can peek at the shuffle or another player's hand.

Built as a hands-on project to practice the Java / Spring Boot / React / Redis / PostgreSQL stack.

---

## Tech stack (in use)

| Layer | Technologies |
|--------|----------------|
| **Backend** | Java, Spring Boot, Spring Web (REST), Spring WebSocket (STOMP), Spring Data Redis, Spring Data JPA, Lombok, Maven |
| **Frontend** | TypeScript, React 19, Next.js 16, Tailwind CSS 4, STOMP.js |
| **Data** | Redis (live session / deck / hands / play areas / turn state), PostgreSQL (wired via Docker Compose + JPA; not used for game data yet) |
| **Infra (local)** | Docker Compose, Git |

### Why these choices

- **Spring Boot** owns the deck, shuffle, deal, turn rules, and action policy — clients never hold authoritative game state.
- **WebSocket (STOMP)** pushes live events (`PLAYER_JOINED`, `CARD_DRAWN`, `CARD_DISCARDED`, `CARDS_PLAYED`, `TURN_CHANGED`, host transfer, lobby setting changes, etc.) to everyone in a session.
- **Redis** stores ephemeral multiplayer state (sessions, roster, deck order, hands, play/dealer areas, turns) for fast reads/writes during play.
- **PostgreSQL** is provisioned and connected for durable data as the app grows (accounts, history, saved decks).
- **Next.js + React + TypeScript** provide the client UI and STOMP subscriptions for create/join, lobby, table layout, and in-game actions.

---

## What works today

### Sessions & lobby

- Create a session with a join code; join by code with a live roster over WebSocket
- Host configures lobby settings before start:
  - **Game mode:** Turn Rotation or Free Rotation
  - **Discard mode:** Off / Turn Discard / Free Discard
  - **Play mode:** Off / Turn Play / Free Play
  - **Deck count:** 1–3 standard 52-card packs
  - **Cards per player:** deal size at game start (0–52)
- Host starts the game; server shuffles, deals, and clears play/dealer areas
- Host transfer and disconnect grace handling when players leave or drop mid-session
- Session rehydrate on refresh (player id / session / display name from `sessionStorage`; private hand re-fetched from the server)

### In-game actions (server-enforced)

- Draw from the shared deck into a private hand
- Multi-card discard from hand, personal play area, or dealer area
- Play cards from hand onto personal face-up play slots
- **Keep** after a draw under Turn Discard (keep the card and end the turn)
- Draw onto a shared **dealer** board (up to 5 slots) and discard from it
- Empty draw pile reshuffles the discard (keeping the top card) with a UI status toast
- Turn / discard / play permissions gated by `TurnActionPolicy` (unit-tested)

### Table UI

- SVG-based table for **1–6 players** with viewer-relative seating
- Face card art (default / selected / drawn-last states), opponent hand backs with real hand counts
- Personal play boards per seat, draw/discard piles, and shared dealer board
- Selection UX: multi-select hand ↔ play slots, activate discard pile to discard selected cards

---

## How this project was built (not vibe coding)

I use AI (Cursor and Claude) as a **thinking partner**, not as an autopilot that writes and lands the code for me.

- Agents stay in **ask mode** — they explain options, sketch designs, and help debug; they do **not** edit the codebase.
- I make every file and code change myself, so I have to understand the APIs, Redis keys, WebSocket contract, and edge cases enough to type them in.
- The [`ai-conversations/`](ai-conversations/) folder is a running log of those sessions (brainstorms, step-by-step build notes, bug hunts). It shows the decision trail behind the app, not a dump of generated PRs.

That keeps the project hands-on: AI accelerates research and architecture talk; ownership of plugging in the code and verifying its contents stays with me.

---

## Project structure

```text
DigitalDeck/
├── ai-conversations/   # Logged Cursor / Claude ask-mode sessions
├── backend/            # Spring Boot API + WebSocket server
│   └── src/test/       # JUnit (e.g. TurnActionPolicyTest)
├── frontend/           # Next.js (React + TypeScript) client
│   ├── app/            # Home → Lobby → Session screens
│   ├── components/     # GameTable, play boards, hand / pile UX
│   └── public/         # SVG boards, card faces, play-spot art
├── scripts/            # Helpers for transforming card / spot SVGs
└── docker-compose.yml  # Postgres 16 + Redis 7
```

---

## Run locally

**1. Start data stores**

```bash
docker compose up -d
```

**2. Backend** (from `backend/`)

```bash
./mvnw spring-boot:run
```

API: `http://localhost:8080` · WebSocket: `ws://localhost:8080/ws`

**3. Frontend** (from `frontend/`)

```bash
npm install
npm run dev
```

UI: `http://localhost:3000`

---

## Architecture (high level)

```text
React / Next.js  ──REST──►  Spring Boot  ──►  Redis (live game state)
        │                        │
        └──STOMP / WebSocket─────┘
                                 └──►  PostgreSQL (wired; unused for game data yet)
```

REST handles session create/resolve, lobby settings, deck init, draw, discard, play, dealer draw, and keep. STOMP broadcasts session events so every connected client stays in sync.

---

## Roadmap (learning targets)

**In progress / started**

- Broader backend tests beyond `TurnActionPolicy` (JUnit / Mockito)

**Next**

- Deploy a playable remote build (env-based API/WS URLs, CORS/WSS)
- Containerize the Spring Boot app; IaC with **Terraform** on **AWS**
- **Cypress** (or similar) for multi-player e2e

**Later**

- Deeper **PostgreSQL** usage (history / accounts)
- Optional learning modules: **GraphQL**, **DynamoDB**, **GitHub Actions** CI/CD
- Product polish (e.g. empty-name join error, optional dealer on/off lobby toggle)

---

## Author

Ava Dennis — learning project focused on production-style full-stack patterns (server-authoritative real-time multiplayer, Redis-backed session state, Spring + React).
