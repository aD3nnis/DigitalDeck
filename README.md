# DigitalDeck

A full-stack multiplayer app that simulates a shared physical card deck online. Players create or join a session with a short code, then draw from a server-authoritative deck in real time — so no client can peek at the shuffle or another player's hand.

Built as a hands-on project to practice the Java / Spring Boot / React / Redis / PostgreSQL stack 

---

## Tech stack (in use)

| Layer | Technologies |
|--------|----------------|
| **Backend** | Java, Spring Boot, Spring Web (REST), Spring WebSocket (STOMP), Spring Data Redis, Spring Data JPA, Lombok, Maven |
| **Frontend** | TypeScript, React, Next.js, Tailwind CSS, STOMP.js |
| **Data** | Redis (live session / deck / turn state), PostgreSQL (wired via Docker Compose + JPA) |
| **Infra (local)** | Docker Compose, Git |

### Why these choices

- **Spring Boot** owns the deck, shuffle, deal, and turn rules — clients never hold authoritative game state.
- **WebSocket (STOMP)** pushes live events (`PLAYER_JOINED`, `CARD_DRAWN`, `TURN_CHANGED`, host transfer, etc.) to everyone in a session.
- **Redis** stores ephemeral multiplayer state (sessions, roster, deck order, hands, turns) for fast reads/writes during play.
- **PostgreSQL** is provisioned and connected for durable data as the app grows (accounts, history, saved decks).
- **Next.js + React + TypeScript** provide the client UI and STOMP subscriptions for create/join, roster, hands, and game modes.

---

## What works today

- Create a session with a join code; choose **Turn Rotation** or **Free Rotation**
- Join by code; live roster updates over WebSocket
- Host starts the game; server shuffles and deals from a shared deck
- Draw cards with private hands (only you see your cards; others see that a draw happened)
- Turn enforcement in Turn Rotation; open drawing in Free Rotation
- Host transfer and disconnect grace handling when players leave or drop mid-session
- Session rehydrate on refresh (player id / session restored from `sessionStorage`)

---

## Project structure

```text
DigitalDeck/
├── backend/          # Spring Boot API + WebSocket server
├── frontend/         # Next.js (React + TypeScript) client
└── docker-compose.yml # Postgres 16 + Redis 7
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
                                 └──►  PostgreSQL (persistence layer)
```

REST handles session create/resolve, deck init, and draws. STOMP broadcasts session events so every connected client stays in sync.

---

## Roadmap (learning targets)

Planned next steps aligned with the same target stack:

- Deploy a playable remote build (env-based API/WS URLs, CORS/WSS)
- Containerize the Spring Boot app; IaC with **Terraform** on **AWS**
- **JUnit** / **Mockito** for backend services; **Cypress** for multi-player e2e
- Deeper **PostgreSQL** usage (history / accounts)
- Optional learning modules: **GraphQL**, **DynamoDB**, **GitHub Actions** CI/CD

---

## Author

Ava Dennis — learning project focused on production-style full-stack patterns (server-authoritative real-time multiplayer, Redis-backed session state, Spring + React).
