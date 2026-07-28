"use client";

import type { GameMode } from "./types";

type Props = {
  roster: Record<string, string>;
  playerId: string;
  gameMode: GameMode;
  currentTurn: string | null;
  hand: string[];
  remaining: number | null;
  onDraw: () => void;
  onLeave: () => void;
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
}: Props) {
  const canDraw =
    gameMode === "FREE_ROTATION" || currentTurn === playerId;

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

      <h2>Your hand</h2>
      <ul>
        {hand.map((card, i) => (
          <li key={i}>{card}</li>
        ))}
      </ul>

      <button onClick={onLeave}>Leave session</button>
    </main>
  );
}