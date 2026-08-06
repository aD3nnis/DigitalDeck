"use client";

import type { DiscardMode, GameMode, PlayMode } from "./types";
import { useEffect, useState } from "react";
import { cardSrc, visualState } from "./CardAssets";
import Card from "./Card";
import styles from "./SessionScreen.module.css";


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
      {Object.entries(roster).map(([id, name]) => {
        const area = playAreas[id] ?? [];
        const isMine = id === playerId;
        return (
          <div key={id}>
            <h3>
              {name + "'s play area"}
              {isMine ? " (you)" : ""}
            </h3>

            {isMine ? (
              <div className={styles.yourPlayBoard}>
                <svg
                  className={styles.yourPlayBoardSvg}
                  viewBox="0 0 350.29 100.91"
                  aria-hidden="true"
                >
                  <g
                    onDoubleClick={async () => {
                      if (!canPlay || selected.length === 0) return;
                      const cards = selectedCards();
                      const ok = await onPlay(cards);
                      if (ok) setSelected([]);
                    }}
                    style={{
                      cursor:
                        canPlay && selected.length > 0 ? "pointer" : undefined,
                    }}
                  >
                    <path
                      className={styles.trapFill}
                      d="M313.46,5.65c-.13-.51-.58-.86-1.11-.86H38.06c-.52,0-.98.35-1.11.86L14.72,93.86c-.09.34-.01.7.21.98.22.28.55.44.9.44h318.76c.35,0,.68-.16.9-.44.22-.28.29-.64.21-.98l-22.24-88.2Z"
                    />
                    <path
                      className={styles.trapStroke}
                      d="M338.25,93.21l-22.24-88.2c-.42-1.68-1.93-2.85-3.66-2.85H38.06c-1.73,0-3.24,1.17-3.66,2.85L12.16,93.21c-.29,1.14-.04,2.32.68,3.25.72.93,1.81,1.46,2.98,1.46h318.76c1.17,0,2.26-.53,2.98-1.46.72-.93.97-2.11.68-3.25ZM335.49,94.84c-.22.28-.55.44-.9.44H15.82c-.35,0-.68-.16-.9-.44-.22-.28-.29-.64-.21-.98L36.95,5.65c.13-.51.58-.86,1.11-.86h274.29c.52,0,.98.35,1.11.86l22.24,88.2c.09.34.01.7-.21.98Z"
                    />
                  </g>
                </svg>
                <div className={styles.yourPlayBoardContent}>
                  <ul className={styles.playCardUnorderedList}>
                    {area.length === 0 ? (
                      <li style={{ listStyle: "none" }}>(empty)</li>
                    ) : (
                      area.map((card, i) => {
                        const order = playSelected.indexOf(i);
                        const isSelected = order !== -1;
                        return (
                          <li
                            className={styles.playCardList}
                            key={`${id}-${card}-${i}`}
                            style={{ listStyle: "none" }}
                          >
                            <Card
                              cardId={card}
                              selected={isSelected}
                              order={isSelected ? order + 1 : undefined}
                              onClick={() => togglePlay(i)}
                            />
                          </li>
                        );
                      })
                    )}
                  </ul>
                  {canPlay && selected.length > 0
                    ? " — double-click to play"
                    : ""}
                </div>
              </div>
            ) : (
              <ul className={styles.playCardUnorderedList}>
                {area.length === 0 ? (
                  <li>(empty)</li>
                ) : (
                  area.map((card, i) => (
                    <li key={`${id}-${card}-${i}`} style={{ listStyle: "none" }}>
                      <Card cardId={card} />
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        );
      })}
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

      {statusMessage && <p>{statusMessage}</p>}

      {playMode !== "PLAY_OFF" && (
        <section>
          <h2>PLAY AREAS</h2>
          {Object.entries(roster).map(([id, name]) => {
            const area = playAreas[id] ?? [];
            const isMine = id === playerId;
            return (
              <div key={id}>
                <h3>
                  {name + "'s play area"}
                  {isMine ? " (you)" : ""}
                </h3>
                <ul className={styles.playCardUnorderedList}>
                  {area.length === 0 ? (
                    <li>(empty)</li>
                  ) : (
                    area.map((card, i) => {
                      if (!isMine) {
                        return (
                          <li key={`${id}-${card}-${i}`} style={{ listStyle: "none" }}>
                            <Card cardId={card} />
                          </li>
                        );
                      }
                    
                      const order = playSelected.indexOf(i);
                      const isSelected = order !== -1;
                    
                      return (
                        <li className={styles.playCardList} key={`${id}-${card}-${i}`} style={{ listStyle: "none" }}>
                          <Card
                            cardId={card}
                            selected={isSelected}
                            order={isSelected ? order + 1 : undefined}
                            onClick={() => togglePlay(i)}
                          />
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            );
          })}

      {discardMode !== "DISCARD_OFF" && (
        <div
          className={styles.discardPile}
          onDoubleClick={async () => {
            if (!canDiscard) return;
            // Prefer play-area selection when both are set
            if (playSelected.length > 0) {
              const ok = await onDiscard(selectedPlayCards(), "PLAY");
              if (ok) setPlaySelected([]);
              return;
            }
            if (selected.length === 0) return;
            const ok = await onDiscard(selectedCards(), "HAND");
            if (ok) {
              setSelected([]);
              setPendingCard(null);
            }
          }}
          style={{
            cursor:
              canDiscard && (selected.length > 0 || playSelected.length > 0)
                ? "pointer"
                : undefined,
          }}
        >
          <div>
            <p>DISCARD PILE:</p>
            {topDiscard && <Card cardId={topDiscard} />}
          </div>
          {canDiscard && (selected.length > 0 || playSelected.length > 0)
            ? " — double-click to discard & end turn"
            : ""}
        </div>
      )}
        </section>
      )}

      <h2>YOUR HAND</h2>
      <ul className={styles.handCardUnorderedList}>
      {hand.map((card, i) => {
        const order = selected.indexOf(i);
        const isSelected = order !== -1;
        const isPending = pendingIndex === i;
        const src = cardSrc(card, visualState({ selected: isSelected, pending: isPending }));

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
            style={{ cursor: "pointer", listStyle: "none" }}
          >
            <img src={src} alt={card} width={80} /* or CSS class */ />
            {isSelected && <span> ({order + 1})</span>}
          </li>
        );
      })}
      </ul>

      <button onClick={onLeave}>Leave session</button>
    </main>
  );
}