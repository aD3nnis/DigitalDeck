## me
I want to write a testing doc for all the scenarios that should be tested with a checkbox next to each edge case tested for my code. So what i mean is there are multiple options for how someone can play: turn rotation + Discard off + Play Off, free rotation + free discard + free play. I want to make sure I get the expected outcome for all these scanrios. The checkbox testing doc that I manually go through is my idea, is there a more automatic testing idea that would work better?

---
## Cursor
A manual checkbox doc works for **UI/visual** checks. For mode × action × “whose turn” outcomes, **automated table-driven tests on `TurnActionPolicy`** are a better fit.

## Why the checklist alone gets painful

Your rule space is a matrix:

| Axis | Values |
|------|--------|
| `gameMode` | `TURN_ROTATION`, `FREE_ROTATION` |
| `discardMode` | `DISCARD_OFF`, `TURN_DISCARD`, `FREE_DISCARD` |
| `playMode` | `PLAY_OFF`, `TURN_PLAY`, `FREE_PLAY` |

Invalid pairs are already coerced away (`FREE_ROTATION` + `TURN_*`), so you have **~13 valid setting combos**. For each combo you care about several actions (draw / play / discard from hand / discard from play) × whose turn × expected allow/deny × whether the turn advances.

That’s dozens of rows. A checklist is fine for a one-time walkthrough; it’s a poor regression suite when you tweak policy again.

You already centralized that logic in `TurnActionPolicy` — that’s the ideal automation target:

```26:71:backend/src/main/java/com/ava/digitaldeck/services/TurnActionPolicy.java
    public Permit permitDraw(...) { ... }
    public Permit permitDiscard(...) { ... }
    public Permit permitPlay(...) { ... }  // always advanceTurnAfter = false
```

## Better approach: layered testing

### 1. Automated policy matrix (highest value)

**Parameterized / table-driven unit tests** that mock `SessionService` + `TurnService` and assert for each row:

- `permitDraw` / `permitDiscard` / `permitPlay` → Allowed or Denied (and error string if useful)
- `advanceTurnAfter` true/false

Example table shape (the doc becomes the test data):

| gameMode | discard | play | actor | action | allowed? | advances? |
|----------|---------|------|-------|--------|----------|-----------|
| TURN_ROTATION | TURN_DISCARD | TURN_PLAY | current | play | yes | no |
| TURN_ROTATION | TURN_DISCARD | TURN_PLAY | other | play | no | — |
| TURN_ROTATION | TURN_DISCARD | TURN_PLAY | current | discard | yes | yes |
| FREE_ROTATION | FREE_DISCARD | FREE_PLAY | anyone | draw | yes | no |
| … | … | … | … | … | … | … |

In JUnit 5 that’s `@ParameterizedTest` + `@CsvSource` / `@MethodSource`. One failure pinpoints the exact combo.

You currently only have the Spring Boot smoke test (`DigitaldeckApplicationTests`) — no policy tests yet — so this is the biggest gap.

### 2. A few API / integration tests (selective)

Automate the “does the HTTP path honor the policy” cases, not every matrix cell:

- Create session with modes → draw/play/discard as wrong player → 403/400
- Play never rotates turn; turn-discard does
- Discard `source: PLAY` vs `HAND` both go through the same permit

Redis + sockets make full e2e heavier; keep this thin.

### 3. Keep a short manual checklist (UI only)

Use checkboxes for things unit tests won’t catch well:

- Play / Discard buttons show or hide for Off / Turn / Free
- Other players’ play areas visible but not selectable
- Multi-card play order looks right
- Lobby coerce: Free Rotation hides Turn Play / Turn Discard

That’s maybe **10–15** UI rows, not the full rules matrix.

## Recommendation

| What | How |
|------|-----|
| “Who can act / does turn advance?” | Automated `TurnActionPolicy` parameterized tests |
| “Endpoint + Redis move cards correctly?” | A handful of integration tests |
| “UI looks right / sync feels right?” | Short manual checkbox doc |

**Practical order:** write the policy table first (it documents expected behavior *and* runs in CI). Keep the manual doc as a thin UI companion, not the source of truth for every mode combo.

If you want, in Agent mode I can draft the full expected-outcome matrix as a markdown checklist *and/or* as JUnit `@MethodSource` rows from your current `TurnActionPolicy` rules.

---
## me
I would like you to: draft the full expected-outcome matrix as a markdown checklist and as JUnit @MethodSource rows from your current TurnActionPolicy rules.

leave the results here in ask mode

---
## Cursor
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

## JUnit `@MethodSource` draft

Assumes Mockito mocks for `SessionService` / `TurnService`. One class, three parameterized tests.

```java
package com.ava.digitaldeck.services;

import com.ava.digitaldeck.model.DiscardMode;
import com.ava.digitaldeck.model.GameMode;
import com.ava.digitaldeck.model.PlayMode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TurnActionPolicyTest {

    private static final String SESSION = "s1";
    private static final String CURRENT = "p-current";
    private static final String OTHER = "p-other";

    @Mock SessionService sessionService;
    @Mock TurnService turnService;

    TurnActionPolicy policy;

    @BeforeEach
    void setUp() {
        policy = new TurnActionPolicy(sessionService, turnService);
        when(turnService.getCurrentPlayer(SESSION)).thenReturn(Optional.of(CURRENT));
    }

    // --- Draw ----------------------------------------------------------------

    static Stream<Arguments> permitDrawCases() {
        return Stream.of(
            // gameMode, discardMode, actorIsCurrent, expectAllowed, expectAdvance, expectErrorOrNull
            Arguments.of(GameMode.TURN_ROTATION, DiscardMode.DISCARD_OFF, true,  true,  true,  null),
            Arguments.of(GameMode.TURN_ROTATION, DiscardMode.DISCARD_OFF, false, false, false, "not your turn"),
            Arguments.of(GameMode.TURN_ROTATION, DiscardMode.TURN_DISCARD, true,  true,  false, null),
            Arguments.of(GameMode.TURN_ROTATION, DiscardMode.TURN_DISCARD, false, false, false, "not your turn"),
            Arguments.of(GameMode.TURN_ROTATION, DiscardMode.FREE_DISCARD, true,  true,  true,  null),
            Arguments.of(GameMode.TURN_ROTATION, DiscardMode.FREE_DISCARD, false, false, false, "not your turn"),

            Arguments.of(GameMode.FREE_ROTATION, DiscardMode.DISCARD_OFF, true,  true, false, null),
            Arguments.of(GameMode.FREE_ROTATION, DiscardMode.DISCARD_OFF, false, true, false, null),
            // unexpected lobby combo — still exercises policy
            Arguments.of(GameMode.FREE_ROTATION, DiscardMode.TURN_DISCARD, true,  true, false, null),
            Arguments.of(GameMode.FREE_ROTATION, DiscardMode.TURN_DISCARD, false, true, false, null),
            Arguments.of(GameMode.FREE_ROTATION, DiscardMode.FREE_DISCARD, true,  true, false, null),
            Arguments.of(GameMode.FREE_ROTATION, DiscardMode.FREE_DISCARD, false, true, false, null)
        );
    }

    @ParameterizedTest(name = "draw {0} discard={1} current={2} → allowed={3} advance={4}")
    @MethodSource("permitDrawCases")
    void permitDraw(
            GameMode gameMode,
            DiscardMode discardMode,
            boolean actorIsCurrent,
            boolean expectAllowed,
            boolean expectAdvance,
            String expectError) {

        when(sessionService.getGameMode(SESSION)).thenReturn(gameMode);
        when(sessionService.getDiscardMode(SESSION)).thenReturn(discardMode);

        String actor = actorIsCurrent ? CURRENT : OTHER;
        TurnActionPolicy.Permit permit = policy.permitDraw(SESSION, actor);
        assertPermit(permit, expectAllowed, expectAdvance, expectError);
    }

    // --- Discard -------------------------------------------------------------

    static Stream<Arguments> permitDiscardCases() {
        return Stream.of(
            // discardMode, gameMode, actorIsCurrent, expectAllowed, expectAdvance, expectErrorOrNull
            Arguments.of(DiscardMode.DISCARD_OFF, GameMode.TURN_ROTATION, true,  false, false, "discard is disabled"),
            Arguments.of(DiscardMode.DISCARD_OFF, GameMode.TURN_ROTATION, false, false, false, "discard is disabled"),
            Arguments.of(DiscardMode.DISCARD_OFF, GameMode.FREE_ROTATION, true,  false, false, "discard is disabled"),
            Arguments.of(DiscardMode.DISCARD_OFF, GameMode.FREE_ROTATION, false, false, false, "discard is disabled"),

            Arguments.of(DiscardMode.TURN_DISCARD, GameMode.TURN_ROTATION, true,  true,  true,  null),
            Arguments.of(DiscardMode.TURN_DISCARD, GameMode.TURN_ROTATION, false, false, false, "not your turn"),
            // unexpected: free rotation + turn discard
            Arguments.of(DiscardMode.TURN_DISCARD, GameMode.FREE_ROTATION, true,  true,  false, null),
            Arguments.of(DiscardMode.TURN_DISCARD, GameMode.FREE_ROTATION, false, false, false, "not your turn"),

            Arguments.of(DiscardMode.FREE_DISCARD, GameMode.TURN_ROTATION, true,  true, false, null),
            Arguments.of(DiscardMode.FREE_DISCARD, GameMode.TURN_ROTATION, false, true, false, null),
            Arguments.of(DiscardMode.FREE_DISCARD, GameMode.FREE_ROTATION, true,  true, false, null),
            Arguments.of(DiscardMode.FREE_DISCARD, GameMode.FREE_ROTATION, false, true, false, null)
        );
    }

    @ParameterizedTest(name = "discard {0} game={1} current={2} → allowed={3} advance={4}")
    @MethodSource("permitDiscardCases")
    void permitDiscard(
            DiscardMode discardMode,
            GameMode gameMode,
            boolean actorIsCurrent,
            boolean expectAllowed,
            boolean expectAdvance,
            String expectError) {

        when(sessionService.getDiscardMode(SESSION)).thenReturn(discardMode);
        // getGameMode only consulted when discard is allowed
        if (expectAllowed) {
            when(sessionService.getGameMode(SESSION)).thenReturn(gameMode);
        } else if (discardMode == DiscardMode.TURN_DISCARD && !actorIsCurrent) {
            // denied before gameMode read — no stub needed
        } else if (discardMode == DiscardMode.DISCARD_OFF) {
            // denied before gameMode read
        } else {
            when(sessionService.getGameMode(SESSION)).thenReturn(gameMode);
        }

        String actor = actorIsCurrent ? CURRENT : OTHER;
        TurnActionPolicy.Permit permit = policy.permitDiscard(SESSION, actor);
        assertPermit(permit, expectAllowed, expectAdvance, expectError);
    }

    // --- Play ----------------------------------------------------------------

    static Stream<Arguments> permitPlayCases() {
        return Stream.of(
            // playMode, actorIsCurrent, expectAllowed, expectErrorOrNull
            Arguments.of(PlayMode.PLAY_OFF, true,  false, "play is disabled"),
            Arguments.of(PlayMode.PLAY_OFF, false, false, "play is disabled"),
            Arguments.of(PlayMode.TURN_PLAY, true,  true,  null),
            Arguments.of(PlayMode.TURN_PLAY, false, false, "not your turn"),
            Arguments.of(PlayMode.FREE_PLAY, true,  true,  null),
            Arguments.of(PlayMode.FREE_PLAY, false, true,  null)
        );
    }

    @ParameterizedTest(name = "play {0} current={1} → allowed={2}")
    @MethodSource("permitPlayCases")
    void permitPlay(
            PlayMode playMode,
            boolean actorIsCurrent,
            boolean expectAllowed,
            String expectError) {

        when(sessionService.getPlayMode(SESSION)).thenReturn(playMode);

        String actor = actorIsCurrent ? CURRENT : OTHER;
        TurnActionPolicy.Permit permit = policy.permitPlay(SESSION, actor);
        // play never advances
        assertPermit(permit, expectAllowed, false, expectError);
    }

    private static void assertPermit(
            TurnActionPolicy.Permit permit,
            boolean expectAllowed,
            boolean expectAdvance,
            String expectError) {

        if (!expectAllowed) {
            assertInstanceOf(TurnActionPolicy.Permit.Denied.class, permit);
            assertEquals(expectError, ((TurnActionPolicy.Permit.Denied) permit).error());
            return;
        }
        assertInstanceOf(TurnActionPolicy.Permit.Allowed.class, permit);
        assertEquals(expectAdvance, ((TurnActionPolicy.Permit.Allowed) permit).advanceTurnAfter());
    }
}
```

**Notes for the discard test stubs:** `permitDiscard` only calls `getGameMode` after the allow path. With strict Mockito you can simplify by always stubbing `getGameMode` / `getDiscardMode` in `@BeforeEach`-style per test, or use `lenient()` — the important part is the `@MethodSource` rows matching the tables above.

**Not covered by policy unit tests** (keep on the manual UI checklist): button visibility, play-area sync, multi-card order, discard `source: HAND|PLAY` card movement. Those need UI / API tests separately.

If you switch to Agent mode, I can add this test class under `backend/src/test/java/...` and a markdown copy under `ai-conversations/`.

--- 
## me
the file had to be changed a bit to work: (sent file TurnActionPolicyTest.java)

---
## Cursor

That version is solid — the important fix vs the draft is `lenient()` on `getCurrentPlayer`.

**Why that was needed:** Mockito’s default (strict) stubs fail if a stub is never used. For `PLAY_OFF` / `DISCARD_OFF` (and some deny paths), `isCurrentPlayer` never runs, so a normal `when(turnService.getCurrentPlayer(...))` in `@BeforeEach` blows up on those rows. `lenient()` keeps the stub for cases that need it without failing the ones that don’t.

Putting the class in `com.ava.digitaldeck` next to `DigitaldeckApplicationTests` is fine; package doesn’t have to match the class under test.

Optional cleanup later (not required for green tests): in `permitDiscard`, always stub both modes and drop the `if/else` — same idea as draw:

```java
when(sessionService.getDiscardMode(SESSION)).thenReturn(discardMode);
lenient().when(sessionService.getGameMode(SESSION)).thenReturn(gameMode);
```

You’ve got the full policy matrix covered: 12 draw + 12 discard + 6 play cases.

---
## me
explain what the file does

---
## Curosr
It’s testing **only** `TurnActionPolicy` — the “may this player do this action, and should the turn advance afterward?” rules. Nothing else.

It does **not** test:

- Redis / saving cards
- HTTP controllers (`POST /draw`, `/discard`, `/play`)
- WebSocket events
- UI (buttons, play areas)
- Whether cards actually move between hand / play / discard

Those layers are assumed to *call* the policy; this file checks the policy’s answers.

---

### What each section checks

**`permitDraw`**  
Given `gameMode` + `discardMode` + whether the actor is the current player:

- Allowed or denied (`not your turn` under turn rotation)
- If allowed: should draw advance the turn?  
  - Yes when turn rotation **and** discard is **not** turn-discard  
  - No when turn-discard (turn ends on discard instead)

**`permitDiscard`**  
Given `discardMode` + `gameMode` + current vs other:

- Denied when discard is off, or turn-discard and it’s not your turn  
- If allowed: advance only for turn rotation **+** turn discard

**`permitPlay`**  
Given `playMode` + current vs other:

- Denied when play is off, or turn-play and not your turn  
- If allowed: **never** advances the turn

---

### How it “runs”

It never starts a real game. It **mocks** `SessionService` and `TurnService` so each row can pretend the session has certain modes and a current player, then asserts the `Permit` result.

So in one line: **it’s a rules spreadsheet for draw / discard / play permissions and turn advancement, encoded as automated tests.**