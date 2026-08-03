## me
lets do this plan with the dual state recommendation
start: pending = none
draw  → if pending: keep it into hand; pending = new card; (selection = [new] recommended)
discard zone → must have selection ≠ empty → remove selection → end turn
double-click pending → clear pending (stays in hand) → end turn
select only old cards → cannot keep/end; can discard to end

In ask mode can you show me the code changes necessary? old cards that are selected will have a border of  #5ac8fa and a solid inner color of #d7ffff
and the pending card will always be border color of #f4c430 until kept. When selected the pending card will have a border color of #f4c430 and a solid inner color of #d7ffff.
--- 
## Cursor
Here’s the dual-state plan mapped onto your current code. Scope: **Turn Rotation + Turn Discard + Play Off**.

---

### Model

| State | Lives | Meaning |
|--------|--------|---------|
| `selected: number[]` | frontend | discard set (multi) |
| `pendingIndex: number \| null` | frontend | just-drawn card |
| `pendingDrawnCard` | Redis (backend) | authorizes **keep** |

Colors you asked for:

| Card state | Border | Fill |
|------------|--------|------|
| Selected (old) | `#5ac8fa` | `#d7ffff` |
| Pending (not selected) | `#f4c430` | none |
| Pending + selected | `#f4c430` | `#d7ffff` |

---

### 1. Backend — store pending + keep endpoint

**`TurnService`** (or a thin helper): Redis key `session:{id}:pendingDrawn:{playerId}`.

```java
// TurnService additions
public void setPendingDrawn(String sessionId, String playerId, String card) {
    redisTemplate.opsForValue().set(
        pendingKey(sessionId, playerId), card, SESSION_TTL);
}

public Optional<String> getPendingDrawn(String sessionId, String playerId) {
    return Optional.ofNullable(
        redisTemplate.opsForValue().get(pendingKey(sessionId, playerId)));
}

public void clearPendingDrawn(String sessionId, String playerId) {
    redisTemplate.delete(pendingKey(sessionId, playerId));
}

/** Clear everyone’s pending when the turn moves. */
public void clearAllPending(String sessionId) {
    // delete keys for players in order, or one session-scoped key if you prefer
}

private String pendingKey(String s, String p) {
    return "session:" + s + ":pendingDrawn:" + p;
}
```

**`TurnActionPolicy`** — add keep; draw already does **not** advance under `TURN_DISCARD` (good).

```java
/** Keep pending draw in hand and end turn. Only when pending exists. */
public Permit permitKeep(String sessionId, String playerId) {
    GameMode mode = sessionService.getGameMode(sessionId);
    DiscardMode discardMode = sessionService.getDiscardMode(sessionId);

    if (mode != GameMode.TURN_ROTATION || discardMode != DiscardMode.TURN_DISCARD) {
        return new Permit.Denied("keep is not available in this mode");
    }
    if (!isCurrentPlayer(sessionId, playerId)) {
        return new Permit.Denied("not your turn");
    }
    if (turnService.getPendingDrawn(sessionId, playerId).isEmpty()) {
        return new Permit.Denied("no pending draw to keep");
    }
    return new Permit.Allowed(true); // always advances
}
```

**`SessionController.draw`** — after a successful draw, set pending (auto-keep previous by overwrite):

```java
// after DeckService.DrawResult result = drawn.get();
turnService.setPendingDrawn(sessionId, request.playerId(), result.card());
// existing CARD_DRAWN + maybeAdvanceTurn (advance still false for TURN_DISCARD)
```

**New keep endpoint:**

```java
@PostMapping("/{sessionId}/keep")
public ResponseEntity<?> keep(@PathVariable String sessionId,
                              @RequestBody KeepRequest request) {
    // session exists check...
    TurnActionPolicy.Permit permit =
        turnActionPolicy.permitKeep(sessionId, request.playerId());
    if (permit instanceof TurnActionPolicy.Permit.Denied(String error)) {
        return ResponseEntity.status(403).body(Map.of("error", error));
    }
    turnService.clearPendingDrawn(sessionId, request.playerId());
    maybeAdvanceTurn(sessionId, true);
    return ResponseEntity.ok(Map.of("ok", true));
}
```

**`SessionController.discard`** — after successful discard that advances, clear pending:

```java
turnService.clearPendingDrawn(sessionId, request.playerId());
maybeAdvanceTurn(sessionId, advanceTurn);
```

Also clear pending inside `maybeAdvanceTurn` (or on every `TURN_CHANGED`) so a leave/skip can’t leave stale pending.

**`KeepRequest`:** `{ "playerId": "..." }` only — keep is by pending identity, not by selection.

---

### 2. Frontend — dual state + gestures + colors

Most of the UX lives in `SessionScreen.tsx`. Today you only have `selected`, and this effect wipes selection on every hand change (including draw):

```75:77:frontend/components/SessionScreen.tsx
  useEffect(() => {
    setSelected([]);
  }, [hand]);
```

That fights “selection = [new] after draw.” Replace with index-aware updates.

#### State + helpers

```tsx
const [selected, setSelected] = useState<number[]>([]);
const [pendingIndex, setPendingIndex] = useState<number | null>(null);

// TURN_DISCARD + TURN_ROTATION + your turn
const keepEnabled =
  gameMode === "TURN_ROTATION" &&
  discardMode === "TURN_DISCARD" &&
  currentTurn === playerId;

const cardStyle = (i: number) => {
  const isSelected = selected.includes(i);
  const isPending = pendingIndex === i;

  if (isPending) {
    return {
      cursor: "pointer",
      border: "2px solid #f4c430",
      background: isSelected ? "#d7ffff" : undefined,
      fontWeight: isSelected ? "bold" : "normal",
    } as const;
  }
  if (isSelected) {
    return {
      cursor: "pointer",
      border: "2px solid #5ac8fa",
      background: "#d7ffff",
      fontWeight: "bold" as const,
    };
  }
  return { cursor: "pointer" as const };
};
```

#### Props

```tsx
type Props = {
  // ...existing
  onDraw: () => Promise<string | null>; // return drawn card, or null on fail
  onKeep: () => Promise<boolean>;
  // onDiscard unchanged
};
```

#### Draw → pending + select new

In `page.tsx` `drawCard`, return the card; in `SessionScreen`:

```tsx
const handleDraw = async () => {
  const card = await onDraw();
  if (!card) return;

  // hand will be [...prev, card] from parent; parent should append first,
  // then child reacts — or do both in one place.

  setHandOptimisticOrViaParent(); // see note below

  setPendingIndex((prevPending) => {
    // previous pending auto-kept: just drop the mark (card already in hand)
    return /* new last index */;
  });
  // After parent appends: pending = hand.length - 1, selection = [that]
};
```

Cleaner pattern: do selection/pending updates in `page.tsx` after draw, and pass `pendingIndex` + `setPendingIndex` / callbacks down — **or** change `onDraw` to return the card and update hand + pending in one handler in `SessionScreen` if you lift less state.

Minimal change in `page.tsx`:

```tsx
const drawCard = async (): Promise<string | null> => {
  // ...existing fetch...
  const { card } = await res.json();
  setHand((prev) => [...prev, card]);
  return card as string;
};

const keepCard = async (): Promise<boolean> => {
  const res = await fetch(`http://localhost:8080/api/sessions/${sessionId}/keep`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId }),
  });
  if (!res.ok) {
    const error = await res.json();
    alert(error.error ?? "Could not keep");
    return false;
  }
  return true;
};
```

In `SessionScreen`, after successful draw:

```tsx
const handleDrawDblClick = async () => {
  if (!canDraw) return;
  const card = await onDraw();
  if (!card) return;

  // Parent already appended; local hand prop updates next render.
  // Track pending as "last index after this draw":
  setPendingIndex(hand.length); // new card will be at this index once hand updates
  setSelected([hand.length]);
};
```

Because `hand` updates async, prefer computing from the returned card inside a callback that uses the new length:

```tsx
setHand is in parent → after await onDraw():
  // parent returns { card, newLength } or SessionScreen receives hand
  // safest:
onDraw success in page, then call a SessionScreen ref/callback —
```

**Practical fix:** move pending/selection into `page.tsx` next to `hand`, or have `drawCard` return and then:

```tsx
// SessionScreen — remove the wipe-everything hand effect; instead:
useEffect(() => {
  // When turn leaves you, clear local dual state
  if (currentTurn !== playerId) {
    setSelected([]);
    setPendingIndex(null);
  }
}, [currentTurn, playerId]);

// On draw success (handler):
setPendingIndex(hand.length); // before React applies new hand: wrong
// Better: parent does:
setHand(prev => {
  const next = [...prev, card];
  // can't set pending here easily
  return next;
});
// So after setHand, use:
setPendingIndexFromDraw(card) 
// with:
useEffect that runs when hand grows and lastCardMatchesDrawn — fragile

// Simplest reliable approach:
const handleDraw = async () => {
  const card = await onDraw(); // parent appends
  if (!card) return;
  setPendingIndex((_) => {
    // use functional update after hand prop — wait one tick:
  });
};
```

**Recommended reliable approach:** keep pending as **card string** from the draw response + resolve index as last index of that value in `hand`:

```tsx
const [pendingCard, setPendingCard] = useState<string | null>(null);

const pendingIndex =
  pendingCard == null ? null : hand.lastIndexOf(pendingCard);

const handleDrawDblClick = async () => {
  const card = await onDraw();
  if (!card) return;
  setPendingCard(card);           // previous pending auto-kept (mark replaced)
  setSelected([/* after hand updates */]);
};

useEffect(() => {
  if (pendingCard == null) return;
  const idx = hand.lastIndexOf(pendingCard);
  if (idx !== -1) setSelected([idx]); // replace selection with new draw
}, [hand, pendingCard]);
```

Duplicates (multi-deck): `lastIndexOf` matches “latest draw” which is what you want.

#### Single-click = toggle selection only

```tsx
onClick={() => toggle(i)}  // never ends turn
```

Pending highlight stays even if deselected (Ace still gold border, King cyan selected).

#### Double-click pending = keep

```tsx
onDoubleClick={async (e) => {
  e.preventDefault();
  if (!keepEnabled || pendingIndex !== i) return;
  const ok = await onKeep();
  if (ok) {
    setPendingCard(null);
    setSelected([]);
  }
}}
```

#### Double-click discard zone

Replace single-click Discard button (for this mode) with double-click on the discard pile / zone:

```tsx
<p
  onDoubleClick={async () => {
    if (!canDiscard || selected.length === 0) return;
    const cards = selectedCards();
    const ok = await onDiscard(cards, "HAND");
    if (ok) {
      setSelected([]);
      setPendingCard(null); // turn ends; server also clears
    }
  }}
>
  Discard pile: {topDiscard ?? "(empty)"}
  {selected.length === 0 ? " (select cards to discard)" : " (double-click to discard)"}
</p>
```

#### Double-click draw

```tsx
{canDraw && (
  <button type="button" onDoubleClick={handleDrawDblClick}>
    Draw (double-click)
  </button>
)}
```

(Optional: keep a single-click button for Free Rotation if you don’t want double-click everywhere.)

---

### 3. Copy / policy notes

Update `setupDescriptions.ts` for `TURN_DISCARD` so it mentions keep:

```ts
// describeGameMode / describeSetup
"On your turn: draw (does not end). Discard selection to end, or double-click the pending (gold) card to keep and end."
```

Policy matrix stays:

| Action | Advances? |
|--------|-----------|
| Draw | No (`TURN_DISCARD` already) |
| Discard (nonempty selection) | Yes |
| Keep (pending exists) | Yes |
| Select old cards only | No |

---

### 4. Tests to add

In `TurnActionPolicyTest`:

- `permitKeep` allowed when `TURN_ROTATION` + `TURN_DISCARD` + current + pending set → advance true  
- Denied: not your turn / no pending / wrong modes  

Optional controller/integration: draw sets pending; second draw overwrites; keep clears + `TURN_CHANGED`; discard clears pending.

---

### Gesture map (what you’re implementing)

```text
start: pending = none, selection = []

double-click draw
  → if pending: auto-keep (clear old mark only)
  → pending = new card (gold border)
  → selection = [new]  (gold border + #d7ffff fill)

single-click card
  → toggle selection only
  → pending mark never removed by this

double-click discard zone
  → require selection ≠ []
  → discard selection → end turn → clear pending

double-click pending card
  → keep → end turn → clear pending

selection of only old cards
  → discard OK; keep denied (no pending / wrong target)
```

---

I'm in **Ask mode**, so this is guidance only. Switch to **Agent mode** if you want these edits applied in the repo.

---
## me
tell me what file and where in the file the code goes, do that with the current state of my code what needs to be completed for the original task

---
## Cursor
You’re partway through, and `SessionScreen.tsx` currently has **two unfinished approaches mixed together**. Below is what’s done, what’s broken, and exactly what to finish — by file and location.

---

## Status snapshot

| Area | Status |
|------|--------|
| Backend pending + keep policy | Mostly done |
| Backend `KeepRequest` class | **Missing** (keep endpoint won’t compile) |
| `page.tsx` draw return | Done |
| `page.tsx` keep + wire `onKeep` | **Missing** |
| `SessionScreen` dual-state UI | **Half-done / conflicting** |

---

## 1. `backend/.../model/KeepRequest.java` — **CREATE this file**

Same folder as `DrawRequest.java`. Copy that pattern:

```java
package com.ava.digitaldeck.model;

public record KeepRequest(String playerId) {}
```

Then in `SessionController.java` (top imports, ~line 15), add:

```java
import com.ava.digitaldeck.model.KeepRequest;
```

Your keep endpoint at lines **363–377** is otherwise fine.

---

## 2. `TurnService.java` — optional cleanup

**Done:** `setPendingDrawn` / `getPendingDrawn` / `clearPendingDrawn` / `pendingKey` (lines 71–93).

**Still empty:** `clearAllPending` (lines 86–89). Either implement it (loop player order and `clearPendingDrawn`) or delete the stub. Not required for the main flow if you clear on discard/keep.

---

## 3. `TurnActionPolicy.java` — **done**

`permitKeep` (lines 73–88) is complete. No change needed.

---

## 4. `SessionController.java` — **almost done**

| Location | Status |
|----------|--------|
| Draw sets pending (line 163) | Done |
| Discard clears pending (line 233) | Done |
| Keep endpoint (363–377) | Done once `KeepRequest` exists |

---

## 5. `frontend/app/page.tsx`

### Done
- `drawCard` returns `string | null` (lines 268–286).

### Still needed

**A. Add `keepCard`** — put it **right after** `drawCard` (after line 286):

```tsx
const keepCard = async (): Promise<boolean> => {
  if (!sessionId) return false;
  const res = await fetch(
    `http://localhost:8080/api/sessions/${sessionId}/keep`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    }
  );
  if (!res.ok) {
    const error = await res.json();
    alert(error.error ?? "Could not keep");
    return false;
  }
  return true;
};
```

**B. Pass it into SessionScreen** — at the bottom return (~line 508), add:

```tsx
onKeep={keepCard}
```

You already pass `onDraw={drawCard}`; `onKeep` is missing.

---

## 6. `SessionScreen.tsx` — this is where most work remains

You currently have **two competing draft approaches**. Pick **one**: `pendingCard` (string). Delete the other.

### DELETE these (conflicting leftovers)

| Lines | What | Why |
|-------|------|-----|
| **76** | `const [pendingIndex, setPendingIndex] = useState...` | Conflicts with derived index below |
| **108–116** | `handleDraw` | Duplicate of `handleDrawDblClick` |
| **160** | `{canDraw && <button onClick={onDraw}>...}` | Wrong: bypasses pending logic; single-click |
| **227–231** | Draw button inside play-areas section | Wrong place |

### KEEP / finish this approach (lines 118–134)

**Replace lines 118–134** with this finished version:

```tsx
const [pendingCard, setPendingCard] = useState<string | null>(null);

const pendingIndex =
  pendingCard == null ? null : hand.lastIndexOf(pendingCard);

const handleDrawDblClick = async () => {
  const card = await onDraw();
  if (!card) return;
  setPendingCard(card);
  // selection is set by the useEffect below once hand updates
};

useEffect(() => {
  if (pendingCard == null) return;
  const idx = hand.lastIndexOf(pendingCard);
  if (idx !== -1) setSelected([idx]);
}, [hand, pendingCard]);

useEffect(() => {
  if (currentTurn !== playerId) {
    setSelected([]);
    setPendingCard(null);
  }
}, [currentTurn, playerId]);
```

Also **destructure `onKeep`** in the component props (around line 33) — it’s in `Props` but not listed in the function args:

```tsx
onKeep,   // add next to onDraw
```

### Wire the UI (exact spots)

**A. Draw button** — where the old button was (~line 160), **after** the turn `<p>`, put **one** draw control:

```tsx
{canDraw && (
  <button type="button" onDoubleClick={handleDrawDblClick}>
    Draw card (double-click)
  </button>
)}
```

**B. Discard zone** — replace the discard `<p>` (~164–166) **and** the Discard button (~259–271) for the hand path with double-click on the pile. Example for the pile line:

```tsx
{discardMode !== "DISCARD_OFF" && (
  <p
    onDoubleClick={async () => {
      if (!canDiscard || selected.length === 0) return;
      const ok = await onDiscard(selectedCards(), "HAND");
      if (ok) {
        setSelected([]);
        setPendingCard(null);
      }
    }}
    style={{ cursor: canDiscard && selected.length > 0 ? "pointer" : undefined }}
  >
    Discard pile: {topDiscard ?? "(empty)"}
    {canDiscard && selected.length > 0
      ? " — double-click to discard & end turn"
      : ""}
  </p>
)}
```

You can leave the Discard **button** as a temporary fallback, or remove it once double-click works.

**C. Hand cards** — replace the hand `<li>` block (~237–255). Use `cardStyle`, single-click toggle, double-click keep:

```tsx
{hand.map((card, i) => {
  const order = selected.indexOf(i);
  const isSelected = order !== -1;
  return (
    <li
      key={`${card}-${i}`}
      onClick={() => toggle(i)}
      onDoubleClick={async (e) => {
        e.preventDefault();
        if (!keepEnabled || pendingIndex !== i) return;
        const ok = await onKeep();
        if (ok) {
          setPendingCard(null);
          setSelected([]);
        }
      }}
      style={cardStyle(i)}
    >
      {card}
      {isSelected && <span> ({order + 1})</span>}
    </li>
  );
})}
```

`cardStyle` (lines 85–106) and `keepEnabled` (79–83) are already good — just make sure `pendingIndex` is the **derived** one from `pendingCard`, not the deleted state.

---

## Order to finish (so it compiles / runs)

1. Create `KeepRequest.java` + import in `SessionController`
2. Add `keepCard` + `onKeep={keepCard}` in `page.tsx`
3. Clean `SessionScreen`: delete duplicates → one `pendingCard` path → wire draw / discard / hand as above

After that, the original dual-state loop works: draw sets gold pending + cyan selection fill; double-click pending keeps; double-click discard ends turn; selecting only old cards cannot keep.