# DigitalDeck — Game rules and expectations

This file defines what "correct" means for game behavior. Tests check these rules; code that disagrees with this file is a bug (or this file needs a decision). Owner: Ava.

Status markers: **Rule** = decided. **Code today** = where the current code differs from the rule. **❓** = open question.

---

## 1. Purpose

DigitalDeck is not one card game. It simulates a shared physical deck, and the lobby settings act as house rules, so one app can host many games. The model is **piles + permissions**, not named games.

## 2. Concepts

**Piles**

- **Deck** — face-down draw pile.
- **Discard pile** — face-up; the most recently discarded card is on top.
- **Hand** — each player's private cards. Other players see only the count.
- **Play area** — each player's own face-up slots (15).
- **Dealer board** — shared face-up slots (5).

**Settings** (chosen by the host in the lobby)

| Question | Setting | Options |
|---|---|---|
| Is there a turn order? | Rotation | **Turn** — players take turns in join order. **Free** — no turns; anyone acts anytime. |
| Is there a discard pile, and who may use it? | Discard | **Off** · **Turn** (current player only) · **Free** (anyone, anytime) |
| Can cards go face-up on the table, and who may play them? | Play | **Off** · **Turn** (current player only) · **Free** (anyone, anytime) |

Also: deck count (1–3 packs), cards dealt per player (0–52).

**Drawn card.** The card a player most recently drew is their *drawn card* (pending). It arrives in the hand already selected. Only the latest draw is pending: drawing again implicitly keeps the previous drawn card (it becomes a normal card in the hand) without ending the turn.

**What ends a turn** (Turn rotation only). The turn ends when the current player:

- **Keeps** their drawn card (double-click it), or
- **Discards** under Turn Discard (any discard ends the turn), or
- **Discards their drawn card** under Free Discard (see 4.3), or
- **Plays** cards when "play ends turn" is on (see 4.4), or
- **Knocks**: double-clicks their hand with nothing selected (see 4.7).

**Drawing never ends the turn**, in any mode: the player draws as many cards as they like, then ends the turn with one of the actions above. Free rotation has no turns, so nothing "ends a turn" and there is no Keep or knock.

*Why (decided 2026-10-22):* this rule supports every game the alternative did (draw-one games just add a Keep), plus draw-until-you-stop games like Blackjack. It gives one turn-ending rule for every mode instead of making it depend on the discard setting, and it matches a physical deck, where players enforce house rules themselves. A draw limit can be added later as its own setting if a game needs one.

Example games under these settings: Rummy/Continental = Turn rotation, Turn discard, Turn play. Texas Hold'em = Turn rotation, Discard off, dealer board for community cards. Speed/Spit = Free rotation. War = Free rotation, Play on, Discard off.

## 3. Valid setting combinations

**Rule:** "Turn" options only make sense when there is a turn order.

| Rotation | Discard: Turn | Play: Turn | Play: Turn, ends turn |
|---|---|---|---|
| Turn | Valid | Valid | Valid (shown nested under Turn play) |
| Free | Hidden | Hidden | Hidden |

**Rule (decided 2026-10-22):** the lobby hides invalid options, and the server rejects invalid combinations (the server is authoritative, so a hand-crafted request can't create one).

**Code today:** the lobby allows Free + Turn discard and Free + Turn play. Because there is no current player in Free rotation, nobody can ever discard or play in those combinations. See change C8.
**Rule (decided 2026-10-22):** if the host switches rotation to Free while a Turn option is selected, it becomes the closest Free option: Turn discard → Free discard, Turn play (either kind) → Free play.

## 4. Actions

### 4.1 Draw

- Takes the top card of the deck into the player's hand as their drawn card (selected). Any previous drawn card is implicitly kept.
- **Turn rotation:** only the current player may draw, any number of times. Drawing never ends the turn.
- **Free rotation:** anyone may draw anytime.
- **Reshuffle:** if the deck is empty, the discard pile is shuffled into the deck, leaving the top discard face-up. If the discard pile has only one card, that card is shuffled in too (otherwise the game gets stuck). Clients are told a reshuffle happened.
- If the deck and discard pile are both empty, the draw fails with "deck is empty".

**Code today:** in Turn rotation, drawing ends the turn unless discard mode is Turn Discard. See change C1.

### 4.2 Keep

- **Turn rotation only** (every discard mode), current player only, and only when they have a pending drawn card.
- Keeps the drawn card in the hand (it becomes a normal, unselected card) and **ends the turn**. Earlier draws this turn were already kept when the next card was drawn.
- UI: double-click the selected drawn card. A drawn card cannot be put back on the deck; to get rid of it, discard it (if discarding is on).
- **Free rotation:** no Keep.

**Code today:** Keep is only available under Turn Discard. See change C2.

### 4.3 Discard

Sources: the player's **hand**, the player's own **play area**, or (host only) the **dealer board**. Discarded cards go on top of the discard pile in order; the last card discarded is the new top.

| Discard mode | Who may discard | Ends the turn? |
|---|---|---|
| Off | Nobody | — |
| Turn | Current player | **Yes**, any discard |
| Free | Anyone, anytime | No, except: in Turn rotation, the current player discarding their pending **drawn card** ends the turn |

- A player may only discard from their own play area, never another player's.
- Under Turn Discard, a player may discard without having drawn first; it still ends their turn.
- Free discard + Free rotation covers games where players draw, discard, and draw again freely.

- Discarding a card other than the pending drawn card leaves the drawn card pending, so it can still be kept.

**Code today:** any discard clears the pending drawn card, even if the discarded card wasn't the drawn one. With the new rules this would strand the player: draw 7♥, discard an old 2♣ under Free Discard, and 7♥ can no longer be kept, so the turn can't end. Free Discard never ends the turn today. See changes C3 and C4.
- **All-or-nothing (decided 2026-10-22):** every card in a multi-card discard is checked first; if any card isn't in the named source, nothing moves and the request fails. Same as play.

**Code today:** discards are processed one card at a time and stop at the first missing card. The earlier cards stay discarded, but the request fails, so no event is broadcast and other players' tables go stale. See change C9.
- **Discarding from the dealer board (decided 2026-10-22):** host only, at any time, and it never ends a turn, the same as dealing (see 4.5). It follows the all-or-nothing rule.

### 4.4 Play

- Moves cards from the player's hand into their own empty play slots, in order (`cards[i]` → `slots[i]`).
- **All-or-nothing:** an invalid, duplicate, or occupied slot, or a card not in the hand, rejects the whole play.
- Turn play: current player only. Free play: anyone. Off: nobody.
- **Rule:** by default, play does not end the turn, even when the played card is the drawn card. This keeps Rummy/Continental working: draw → meld including the drawn card → discard to end the turn.
- **Play ends turn** (decided 2026-10-22): a Turn rotation option where a successful play ends the current player's turn, the same way Turn Discard works for discards. This is for trick-taking and shedding games (Hearts, Spades, Euchre, Bridge, President, Cribbage pegging), where every turn is "play a card, done".

- **Shape (decided 2026-10-22):** a fourth play mode, stored on the server alongside Off / Turn / Free. The lobby shows it as a sub-option that appears only when Turn play is selected.

### 4.5 Dealer board

A shared face-up area in the center (5 slots), for community cards (Texas Hold'em, Omaha) or the house's hand (Blackjack, Baccarat).

- **Dealer board setting (decided 2026-10-22):** an on/off lobby setting. Off hides the board (Rummy, Go Fish, Crazy Eights). Name stays "dealer board".
- **Who deals (decided 2026-10-22):** the **host** only. Dealing draws cards from the deck directly onto empty dealer slots (up to 5). All-or-nothing: if the deck runs out partway, already-drawn cards go back on top of the deck. Reshuffles the same way as a normal draw.
- Dealing never ends a turn. Dealer cards never go into a hand, so they are not drawn cards and cannot be kept.
- **New rounds:** in v1 there is no "next round" reset. To play another hand, start a new session.

- **When (decided 2026-10-22):** the host may deal at any time, including in Turn rotation when it isn't their turn (in Hold'em the flop is dealt between betting rounds, not on the dealer's turn). The host may also discard dealer cards at any time (see 4.3).

**Code today:** dealing uses the normal draw permission (current player in Turn rotation, anyone in Free) and can end the turn. There is no on/off setting. See change C15.

**Later (v2):** playing cards from a hand onto a shared center area, for trick-taking games (Hearts, Spades, Euchre, Bridge) and center-pile games (President, War, Speed). The server function `DeckService.playCardsToDealer` already does this but has no endpoint or UI; leave it unused until then. Blocker: tricks need one slot per player (up to 6), and the dealer board has room for 5.

### 4.6 Leave and disconnect

- A dropped connection gets a **10-second grace period**. Rejoining within it keeps the player's seat and turn.
- The **Leave** button removes the player immediately.
- If the leaving player was the current player, the turn passes to the next player in order. If they were the host, host passes to another player.

- **Rule (decided 2026-10-22):** a leaving player's hand and play area go to the discard pile, so no cards drop out of the game. They go **underneath** the current top discard: the top card doesn't change.
- If the discard pile is empty, the leaving player's cards form the pile and one of them shows as the top.
- **What counts as leaving:** clicking Leave (immediate), or staying disconnected past the 10-second grace period (closed tab, lost connection). A page refresh or a brief drop under 10 seconds is not leaving. A session expiring after 4 idle hours is not a leave either; the whole session ends.

**Code today:** the cards stay in Redis and drop out of the game. See change C14.

### 4.7 Knock (end turn with no other action)

**Rule (decided 2026-10-22):** in Turn rotation, the current player may end their turn at any time by **double-clicking their hand while no cards are selected**. No requirements: they don't need to have drawn, played, or discarded.

- No button or new table area: the table is already full at 6 players, and the hand is the one space every player always has. It mirrors tapping or setting down your cards at a real table.
- **Keep vs. knock:** with the drawn card selected, double-clicking it is Keep. With nothing selected, double-clicking the hand is a knock. Both end the turn.
- Empty hand: double-click the empty hand area.
- On the server, Keep and knock are the same "end turn" action; the pending drawn card only affects what is highlighted.
- Free rotation: no knock.

Why it's needed — turns that no other action can end:

| Situation | Games |
|---|---|
| End the turn without drawing | Blackjack stand, five-card draw "stand pat", poker check/fold, President pass, Cribbage "go" |
| Only dealt to the dealer board, or only played cards (play doesn't end the turn) | Texas Hold'em flop, Rummy variants without a discard |
| Drew a card, then played it, with discarding off | Rummy variants |
| Deck and discard pile both empty | Crazy Eights, any long game |

UI notes: the frontend must keep a double-click from also toggling selection on single clicks. A one-line lobby tip ("Double-click your hand to end your turn") teaches it.

**Later (not v1):** an optional idle timer for a connected player who never ends their turn. Lobby presets that set the right combination per game (e.g. five-card draw needs Free Discard, since Turn Discard would end the turn before the replacement draw).

## 5. Information rules

- The server is authoritative: clients never decide whether an action is allowed.
- Hands are private. Other players see hand counts, never card identities.
- Every successful action is broadcast to everyone in the session.

## 6. Code changes required

Places where the code doesn't match the decided rules yet. Each gets a test first, then the fix. Remove an item once it ships.

**Turn rule (decided 2026-10-22: drawing never ends the turn)**

| # | Change | Where |
|---|---|---|
| C1 | Drawing never advances the turn. (Dealer dealing gets its own permit in C15.) | `TurnActionPolicy.permitDraw` |
| C2 | Keep is allowed in every Turn rotation mode, not only Turn Discard. (Covered by C11.) | `TurnActionPolicy.permitKeep` |
| C3 | A discard clears the pending drawn card only if the discarded card *is* the pending card. | `SessionController` discard endpoint / `TurnService` |
| C4 | Under Free Discard in Turn rotation, the current player discarding their pending drawn card ends the turn. Needs the policy to know which cards are being discarded. | `TurnActionPolicy.permitDiscard` |
| C5 | Lobby text: "drawing ends your turn" → "double-click your drawn card to end your turn"; Free Discard notes the drawn-card exception. | `frontend/components/setupDescriptions.ts` |
| C6 | Keep is reachable by double-clicking the selected drawn card, in every Turn rotation mode; drawn cards arrive selected (with an animation from the draw pile). | Frontend hand / `page.tsx` |
| C7 | Update `TurnActionPolicyTest` cases that pin the old behavior (draw advancing the turn, Keep only under Turn Discard). | `backend/src/test` |

**Ending a turn (decided 2026-10-22: play ends turn option, knock)**

| # | Change | Where |
|---|---|---|
| C11 | Replace Keep with one "end turn" action: current player in Turn rotation, no pending-card requirement. Keep becomes the same call. | `TurnActionPolicy.permitKeep` → end-turn permit; `/keep` endpoint |
| C12 | "Play ends turn" setting: stored per session, set in the lobby, and `permitPlay` returns `advanceTurnAfter = true` when on. Stored as a fourth `PlayMode` value; lobby shows it nested under Turn play. | `PlayMode` / `SessionService` / `TurnActionPolicy.permitPlay` / lobby |
| C13 | Knock gesture: double-click the hand with nothing selected calls end turn; double-click must not also toggle selection. Lobby tip text. | Frontend hand / `setupDescriptions.ts` |

**Found while writing these rules**

| # | Change | Status |
|---|---|---|
| C8 | Free rotation + Turn options: hide them in the lobby, reject them on the server, and remap Turn → Free when rotation switches to Free. | Decided |
| C9 | Multi-card discard becomes all-or-nothing (check every card, then move all or none). | Decided |
| C14 | A leaving player's hand and play area move to the discard pile, underneath the current top discard, when the leave is finalized (Leave button, or grace period expired). | Decided |
| C15 | Dealer board: on/off lobby setting; dealing and dealer discards allowed for the host only, at any time, never ending a turn (own permit in `TurnActionPolicy`, not `permitDraw` / `permitDiscard`). | Decided |
