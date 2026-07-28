## me
question, what is the expected outcome i should have for free rotation and turn discard?

---
## Cursor
**Free Rotation + Turn Discard is a weird combo** — and with your current code it doesn’t really work as a coherent game mode.

### What each setting means on its own

| Setting | Controls |
|---|---|
| **Free Rotation** | Anyone can draw anytime; no turn clock for drawing |
| **Turn Discard** | Only the “current” player may discard; (with Turn Rotation) discard advances the turn |

### What your code does today

1. **Draw** — works for everyone (Free Rotation skips the turn check; turn never advances on draw).
2. **Discard** — requires `currentTurn == you`.
3. **Turns are never started** in Free Rotation (`startTurns` only runs for Turn Rotation).

So `currentTurn` stays empty → every discard gets **403 "not your turn"**. Draw works; discard is broken.

That matches what you already noted in the brainstorm: Free + Turn is allowed but not really supported in v1.

### Expected outcomes for the combos that *are* intentional

| Draw | Discard | Expected feel |
|---|---|---|
| **Turn + Turn** | Continental-ish | Only current player draws & discards; draw does *not* end turn; discard does |
| **Turn + Off** | Draw-only turns | Only current draws; no discard; draw advances turn |
| **Turn + Free** | Odd but ok | Only current draws; anyone can discard; draw advances turn |
| **Free + Free** | Casual free-for-all | Anyone draws, anyone discards; no turns |
| **Free + Off** | Shared deck, no discard | Anyone draws; no discard; no turns |
| **Free + Turn** | Not a real pattern | Don’t rely on this in v1 |

### Practical takeaway

Don’t test Free Rotation + Turn Discard as a happy path. Prefer:

- **Turn + Turn** for “take turns playing”
- **Free + Free** for “anyone can do anything”

If you ever want Free + Turn to mean something, you’d need to start a turn clock just for discard (or redefine “turn discard” without `currentTurn`). Until then, treat it as unsupported.

---
## me
so lets have it where only the plausable combinations show up so not Free + Turn lets code that into the UI

---
## Cursor
Hide **Turn Discard** whenever draw mode is **Free Rotation**, and auto-fix discard if someone switches into Free while Turn Discard is selected.

### Rule

| Draw mode | Discard options shown |
|---|---|
| Turn Rotation | Off, Turn Discard, Free Discard |
| Free Rotation | Off, Free Discard only |

If current selection is Free + Turn, coerce discard to `DISCARD_OFF` (or `FREE_DISCARD` — Off is safer).

---

### 1. Optional helper in `types.ts`

```ts
export type GameMode = "TURN_ROTATION" | "FREE_ROTATION";
export type DiscardMode = "DISCARD_OFF" | "TURN_DISCARD" | "FREE_DISCARD";

export function isDiscardModeAllowed(
  gameMode: GameMode,
  discardMode: DiscardMode
): boolean {
  if (gameMode === "FREE_ROTATION" && discardMode === "TURN_DISCARD") {
    return false;
  }
  return true;
}

export function coerceDiscardMode(
  gameMode: GameMode,
  discardMode: DiscardMode
): DiscardMode {
  return isDiscardModeAllowed(gameMode, discardMode)
    ? discardMode
    : "DISCARD_OFF";
}
```

---

### 2. `HomeScreen.tsx` — hide Turn Discard under Free

```tsx
<section>
  <label>
    <input
      type="radio"
      name="discardMode"
      checked={discardMode === "DISCARD_OFF"}
      onChange={() => onDiscardModeChange("DISCARD_OFF")}
    />
    Discard Off
  </label>

  {gameMode === "TURN_ROTATION" && (
    <label>
      <input
        type="radio"
        name="discardMode"
        checked={discardMode === "TURN_DISCARD"}
        onChange={() => onDiscardModeChange("TURN_DISCARD")}
      />
      Turn Discard
    </label>
  )}

  <label>
    <input
      type="radio"
      name="discardMode"
      checked={discardMode === "FREE_DISCARD"}
      onChange={() => onDiscardModeChange("FREE_DISCARD")}
    />
    Free Discard
  </label>
</section>
```

And when changing **game** mode on the home screen, coerce discard:

```tsx
onChange={() => onGameModeChange("FREE_ROTATION")}
```

Better: change the parent handler so one place owns the rule (below).

---

### 3. Same hide in `LobbyScreen.tsx`

Wrap the Turn Discard radio the same way:

```tsx
{gameMode === "TURN_ROTATION" && (
  <label>
    <input
      type="radio"
      name="discardMode"
      checked={discardMode === "TURN_DISCARD"}
      onChange={() => onUpdateDiscardMode("TURN_DISCARD")}
    />
    Turn Discard
  </label>
)}
```

---

### 4. `page.tsx` — coerce when switching to Free

**Home create flow** (`onGameModeChange`):

```tsx
import { coerceDiscardMode } from "../components/types";

const handleGameModeChange = (next: GameMode) => {
  setGameMode(next);
  setDiscardMode((prev) => coerceDiscardMode(next, prev));
};

// HomeScreen:
onGameModeChange={handleGameModeChange}
```

**Lobby** (`updateGameMode`): after a successful PATCH, also fix discard if needed:

```tsx
const updateGameMode = async (next: "TURN_ROTATION" | "FREE_ROTATION") => {
  if (!sessionId) return;
  const res = await fetch(
    `http://localhost:8080/api/sessions/${sessionId}/game-mode`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameMode: next, playerId }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    alert(err.error ?? "Could not update mode");
    return;
  }

  setGameMode(next);

  const nextDiscard = coerceDiscardMode(next, discardMode);
  if (nextDiscard !== discardMode) {
    await updateDiscardMode(nextDiscard);
  }
};
```

That way switching lobby from Turn+Turn → Free also flips discard to Off via the existing discard-mode endpoint, so other clients stay in sync.

---

Backend can still accept Free+Turn if someone crafts a request; UI-only is enough for v1. Optional later: reject that combo in `createSession` / mode PATCH with 400.

Switch to Agent mode if you want this applied in the repo.