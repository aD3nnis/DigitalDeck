Derived from current `TurnActionPolicy` only. Play never advances. Frontend coerces away `FREE_ROTATION` + `TURN_*`; the backend does **not**, so those appear under “unexpected Redis state.”

---

## Quick rule reference

| Action | Denied when | Allowed + `advanceTurnAfter` |
|--------|-------------|------------------------------|
| **Draw** | `TURN_ROTATION` and not current | Advance iff `TURN_ROTATION` **and** discard ≠ `TURN_DISCARD` |
| **Discard** | `DISCARD_OFF`, or `TURN_DISCARD` and not current | Advance iff `TURN_ROTATION` **and** `TURN_DISCARD` |
| **Play** | `PLAY_OFF`, or `TURN_PLAY` and not current | Always `advance = false` |

`playMode` does not affect draw/discard. `discardMode` / `gameMode` do not affect play (except turn identity via `TURN_PLAY`).

---

## Valid lobby checklist (13 settings)

Use these for a manual walkthrough. Actor = **Current** (their turn) or **Other**.

### A. Turn Rotation × Discard Off

#### A1. Play Off
- [ ] Current **draw** → allow, **advance yes**
- [ ] Other **draw** → deny (`not your turn`)
- [ ] Current **discard** → deny (`discard is disabled`)
- [ ] Other **discard** → deny (`discard is disabled`)
- [ ] Current **play** → deny (`play is disabled`)
- [ ] Other **play** → deny (`play is disabled`)

#### A2. Turn Play
- [ ] Current **draw** → allow, **advance yes**
- [ ] Other **draw** → deny
- [ ] Current/Other **discard** → deny (`discard is disabled`)
- [ ] Current **play** → allow, **advance no**
- [ ] Other **play** → deny (`not your turn`)

#### A3. Free Play
- [ ] Current **draw** → allow, **advance yes**
- [ ] Other **draw** → deny
- [ ] Current/Other **discard** → deny (`discard is disabled`)
- [ ] Current **play** → allow, **advance no**
- [ ] Other **play** → allow, **advance no**

---

### B. Turn Rotation × Turn Discard

#### B1. Play Off
- [ ] Current **draw** → allow, **advance no**
- [ ] Other **draw** → deny
- [ ] Current **discard** → allow, **advance yes**
- [ ] Other **discard** → deny
- [ ] Current/Other **play** → deny (`play is disabled`)

#### B2. Turn Play *(War-ish: play then discard to end turn)*
- [ ] Current **draw** → allow, **advance no**
- [ ] Other **draw** → deny
- [ ] Current **discard** (hand or play area) → allow, **advance yes**
- [ ] Other **discard** → deny
- [ ] Current **play** → allow, **advance no**
- [ ] Other **play** → deny

#### B3. Free Play
- [ ] Current **draw** → allow, **advance no**
- [ ] Other **draw** → deny
- [ ] Current **discard** → allow, **advance yes**
- [ ] Other **discard** → deny
- [ ] Current **play** → allow, **advance no**
- [ ] Other **play** → allow, **advance no**

---

### C. Turn Rotation × Free Discard

#### C1. Play Off
- [ ] Current **draw** → allow, **advance yes**
- [ ] Other **draw** → deny
- [ ] Current **discard** → allow, **advance no**
- [ ] Other **discard** → allow, **advance no**
- [ ] Current/Other **play** → deny (`play is disabled`)

#### C2. Turn Play
- [ ] Current **draw** → allow, **advance yes**
- [ ] Other **draw** → deny
- [ ] Current/Other **discard** → allow, **advance no**
- [ ] Current **play** → allow, **advance no**
- [ ] Other **play** → deny

#### C3. Free Play
- [ ] Current **draw** → allow, **advance yes**
- [ ] Other **draw** → deny
- [ ] Current/Other **discard** → allow, **advance no**
- [ ] Current/Other **play** → allow, **advance no**

---

### D. Free Rotation × Discard Off

#### D1. Play Off
- [ ] Any **draw** → allow, **advance no**
- [ ] Any **discard** → deny (`discard is disabled`)
- [ ] Any **play** → deny (`play is disabled`)

#### D2. Free Play
- [ ] Any **draw** → allow, **advance no**
- [ ] Any **discard** → deny (`discard is disabled`)
- [ ] Any **play** → allow, **advance no**

---

### E. Free Rotation × Free Discard

#### E1. Play Off
- [ ] Any **draw** → allow, **advance no**
- [ ] Any **discard** → allow, **advance no**
- [ ] Any **play** → deny (`play is disabled`)

#### E2. Free Play *(full free table)*
- [ ] Any **draw** → allow, **advance no**
- [ ] Any **discard** → allow, **advance no**
- [ ] Any **play** → allow, **advance no**

---

## Unexpected combos (backend accepts; lobby coerces away)

If Redis ever has these:

### Free Rotation + Turn Discard
- [ ] **Draw** (anyone) → allow, advance no
- [ ] Current **discard** → allow, **advance no** (needs `TURN_ROTATION` to advance)
- [ ] Other **discard** → deny (`not your turn`)

### Free Rotation + Turn Play
- [ ] Current **play** → allow, advance no
- [ ] Other **play** → deny (`not your turn`) — turn gate still applies even without turn rotation

---

## Deduped policy table (what the tests encode)

**Draw** (`playMode` ignored):

| gameMode | discardMode | isCurrent | allowed | advance | error |
|----------|-------------|-----------|---------|---------|-------|
| TURN_ROTATION | DISCARD_OFF | true | yes | yes | — |
| TURN_ROTATION | DISCARD_OFF | false | no | — | not your turn |
| TURN_ROTATION | TURN_DISCARD | true | yes | no | — |
| TURN_ROTATION | TURN_DISCARD | false | no | — | not your turn |
| TURN_ROTATION | FREE_DISCARD | true | yes | yes | — |
| TURN_ROTATION | FREE_DISCARD | false | no | — | not your turn |
| FREE_ROTATION | DISCARD_OFF | true/false | yes | no | — |
| FREE_ROTATION | TURN_DISCARD | true/false | yes | no | — |
| FREE_ROTATION | FREE_DISCARD | true/false | yes | no | — |

**Discard** (`playMode` ignored):

| discardMode | gameMode | isCurrent | allowed | advance | error |
|-------------|----------|-----------|---------|---------|-------|
| DISCARD_OFF | * | * | no | — | discard is disabled |
| TURN_DISCARD | TURN_ROTATION | true | yes | yes | — |
| TURN_DISCARD | TURN_ROTATION | false | no | — | not your turn |
| TURN_DISCARD | FREE_ROTATION | true | yes | no | — |
| TURN_DISCARD | FREE_ROTATION | false | no | — | not your turn |
| FREE_DISCARD | TURN_ROTATION | true/false | yes | no | — |
| FREE_DISCARD | FREE_ROTATION | true/false | yes | no | — |

**Play** (`gameMode` / `discardMode` ignored by policy):

| playMode | isCurrent | allowed | advance | error |
|----------|-----------|---------|---------|-------|
| PLAY_OFF | * | no | — | play is disabled |
| TURN_PLAY | true | yes | no | — |
| TURN_PLAY | false | no | — | not your turn |
| FREE_PLAY | true/false | yes | no | — |

---
