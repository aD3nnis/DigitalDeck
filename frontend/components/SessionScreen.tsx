"use client";

import type { DiscardMode, GameMode } from "./types";

type Props = {
  roster: Record<string, string>;
  playerId: string;
  gameMode: GameMode;
  currentTurn: string | null;
  hand: string[];
  remaining: number | null;
  discardMode: DiscardMode;
  topDiscard: string | null;
  onDraw: () => void;
  onLeave: () => void;
  onDiscard: (card: string) => void;
  statusMessage: string | null;
};


export default function SessionScreen({
  roster,
  playerId,
  gameMode,
  currentTurn,
  hand,
  remaining,
  onDraw,
  onLeave,
  discardMode,
  topDiscard,
  onDiscard,
  statusMessage,
}: Props) {
  const canDraw =
    gameMode === "FREE_ROTATION" || currentTurn === playerId;
  const canDiscard =
    discardMode === "FREE_DISCARD" ||
    (discardMode === "TURN_DISCARD" && currentTurn === playerId);


  return (
    <main>
      <h1>Game</h1>

      <h2>Players</h2>
      <ul>
        {Object.entries(roster).map(([id, name]) => (
          <li key={id}>
            {name} <small>({id})</small>
          </li>
        ))}
      </ul>

      {gameMode === "TURN_ROTATION" && (
        <p>
          Current turn: {currentTurn ? roster[currentTurn] ?? currentTurn : "—"}
          {currentTurn === playerId && " (this is you!)"}
        </p>
      )}

      {canDraw && <button onClick={onDraw}>Draw card</button>}

      <p>Cards remaining: {remaining}</p>

      {discardMode !== "DISCARD_OFF" && (
        <p>Discard pile: {topDiscard ?? "(empty)"}</p>
      )}
      {statusMessage && <p>{statusMessage}</p>}
      
      <h2>Your hand</h2>
      <ul>
      {hand.map((card, i) => (
        <li key={`${card}-${i}`}>
          {card}
          {canDiscard && (
            <button type="button" onClick={() => onDiscard(card)}>
              Discard
            </button>
          )}
        </li>
      ))}
    </ul>

      <button onClick={onLeave}>Leave session</button>
    </main>
  );
}