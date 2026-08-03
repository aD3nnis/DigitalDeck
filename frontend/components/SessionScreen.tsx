"use client";

import type { DiscardMode, GameMode, PlayMode } from "./types";
import { useEffect, useState } from "react";

type Props = {
  roster: Record<string, string>;
  playerId: string;
  gameMode: GameMode;
  currentTurn: string | null;
  hand: string[];
  remaining: number | null;
  discardMode: DiscardMode;
  playMode: PlayMode;
  playAreas: Record<string, string[]>;
  topDiscard: string | null;
  onLeave: () => void;
  onDiscard: (cards: string[], source: "HAND" | "PLAY") => Promise<boolean>;
  onPlay: (cards: string[]) => Promise<boolean>;
  statusMessage: string | null;
  onDraw: () => Promise<string | null>; // return drawn card, or null on fail
  onKeep: () => Promise<boolean>;
 
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
  playMode,
  playAreas,
  topDiscard,
  onDiscard,
  statusMessage,
  onPlay,
  onKeep,
}: Props) {
  const canDraw =
    gameMode === "FREE_ROTATION" || currentTurn === playerId;
  const canDiscard =
    discardMode === "FREE_DISCARD" ||
    (discardMode === "TURN_DISCARD" && currentTurn === playerId);
  const canPlay =
    playMode === "FREE_PLAY" ||
    (playMode === "TURN_PLAY" && currentTurn === playerId);

  const [playSelected, setPlaySelected] = useState<number[]>([]);

  const toggle = (i: number) => {
    setSelected((prev) => {
      const at = prev.indexOf(i);
      if (at !== -1) return prev.filter((_, j) => j !== at);
      return [...prev, i];
    });
  };

  const togglePlay = (i: number) => {
    setPlaySelected((prev) => {
      const at = prev.indexOf(i);
      if (at !== -1) return prev.filter((_, j) => j !== at);
      return [...prev, i];
    });
  };

  const selectedCards = () => selected.map((i) => hand[i]);
  const myPlayArea = playAreas[playerId]; // string[] | undefined
  const selectedPlayCards = () =>
    playSelected.map((i) => (myPlayArea ?? [])[i]);

  const [selected, setSelected] = useState<number[]>([]);


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

  useEffect(() => {
    setPlaySelected([]);
  }, [myPlayArea]);

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
      {canDraw && (
        <button type="button" onDoubleClick={handleDrawDblClick}>
          Draw card (double-click)
        </button>
      )}
      <p>Cards remaining: {remaining}</p>

      {discardMode !== "DISCARD_OFF" && (
        <p>Discard pile: {topDiscard ?? "(empty)"}</p>
      )}
      {statusMessage && <p>{statusMessage}</p>}

      {playMode !== "PLAY_OFF" && (
        <section>
          <h2>Play areas</h2>
          {Object.entries(roster).map(([id, name]) => {
            const area = playAreas[id] ?? [];
            const isMine = id === playerId;
            return (
              <div key={id}>
                <h3>
                  {name}
                  {isMine ? " (you)" : ""}
                </h3>
                <ul>
                  {area.length === 0 ? (
                    <li>(empty)</li>
                  ) : (
                    area.map((card, i) => {
                      if (!isMine) {
                        return <li key={`${id}-${card}-${i}`}>{card}</li>;
                      }
                      const order = playSelected.indexOf(i);
                      const isSelected = order !== -1;
                      return (
                        <li
                          key={`${id}-${card}-${i}`}
                          onClick={() => togglePlay(i)}
                          style={{
                            cursor: "pointer",
                            fontWeight: isSelected ? "bold" : "normal",
                            outline: isSelected
                              ? "2px solid currentColor"
                              : undefined,
                          }}
                        >
                          {card}
                          {isSelected && <span> ({order + 1})</span>}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            );
          })}

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
        </section>
      )}

      <h2>Your hand</h2>
      <ul>
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
      </ul>

      <div>
        {discardMode !== "DISCARD_OFF" && (
          <button
            type="button"
            disabled={!canDiscard || selected.length === 0}
            onClick={async () => {
              const cards = selectedCards();
              const ok = await onDiscard(cards, "HAND");
              if (ok) setSelected([]);
            }}
          >
            Discard
          </button>
        )}

        {playMode !== "PLAY_OFF" && (
          <button
            type="button"
            disabled={!canPlay || selected.length === 0}
            onClick={async () => {
              const cards = selectedCards();
              const ok = await onPlay(cards);
              if (ok) setSelected([]);
            }}
          >
            Play
          </button>
        )}
      </div>

      <button onClick={onLeave}>Leave session</button>
    </main>
  );
}