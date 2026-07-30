"use client";

import type { DiscardMode, GameMode } from "./types";
import { useEffect, useState } from "react";

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
  onDiscard: (cards: string[]) => Promise<boolean>;
  onPlay: (cards: string[]) => Promise<boolean>;
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
  onPlay,
}: Props) {
  const canDraw =
    gameMode === "FREE_ROTATION" || currentTurn === playerId;
  const canDiscard =
    discardMode === "FREE_DISCARD" ||
    (discardMode === "TURN_DISCARD" && currentTurn === playerId);
    const [selected, setSelected] = useState<number[]>([]);

    const toggle = (i: number) => {
      setSelected((prev) => {
        const at = prev.indexOf(i);
        if (at !== -1) return prev.filter((_, j) => j !== at); // deselect
        return [...prev, i]; // append = most recently selected
      });
    };
    
    const selectedCards = () => selected.map((i) => hand[i]);
    
    useEffect(() => {
      setSelected([]);
    }, [hand]);
  



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
      {hand.map((card, i) => {
          const order = selected.indexOf(i);
          const isSelected = order !== -1;

          return (
            <li
              key={`${card}-${i}`}
              onClick={() => toggle(i)}
              style={{
                cursor: "pointer",
                fontWeight: isSelected ? "bold" : "normal",
                outline: isSelected ? "2px solid currentColor" : undefined,
              }}
            >
              {card}
              {isSelected && <span> ({order + 1})</span>}
            </li>
          );
        })}
      </ul>
      {discardMode !== "DISCARD_OFF" && (
        <div>
           <button
            type="button"
            disabled={!canDiscard || selected.length === 0}
            onClick={async () => {
              const cards = selectedCards();
              const ok = await onDiscard(cards);
              if (ok) setSelected([]);
            }}
          >
            Discard
          </button>
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={async () => {
              const cards = selectedCards();
              const ok = await onPlay(cards);
              if (ok) setSelected([]);
            }}
          >
            Play
          </button>
        </div>
      )}

      <button onClick={onLeave}>Leave session</button>
    </main>
  );
}