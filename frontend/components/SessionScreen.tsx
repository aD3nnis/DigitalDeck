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

  const handleDrawDblClick = async () => {
    const card = await onDraw();
    if (!card) return;
    setPendingCard(card);
  };

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

      {/* DRAW SECTION:  */}
      <section style={{ display: "flex", justifyContent: "center" }}>
      <div className={styles.drawBoard}>
        <svg
          className={styles.yourPlayBoardSvg}
          viewBox="0 0 50 77.55"
          aria-hidden="true"
        >
          <g
            onDoubleClick={handleDrawDblClick}
            style={{
              cursor: canDraw ? "pointer" : undefined,
            }}
          >
            <path
              className={styles.trapFill}
              d="M5.53,73.14c.23.35.64.55,1.09.55h36.63c.7,0,1.27-.51,1.27-1.14v-36.53c0-.63-.57-1.14-1.27-1.14h-22.09c-.54,0-1.02.31-1.2.76l-14.54,36.53c-.18.44,0,.8.11.97Z"
            />
            <path
              className={styles.trapStroke}
              d="M6.62,76.33h36.63c2.16,0,3.91-1.69,3.91-3.78v-36.53c0-2.08-1.75-3.78-3.91-3.78h-22.09c-1.61,0-3.07.97-3.65,2.42L2.97,71.19c-.46,1.15-.32,2.4.38,3.43.73,1.07,1.95,1.71,3.27,1.71ZM21.16,34.88h22.09c.7,0,1.27.51,1.27,1.14v36.53c0,.63-.57,1.14-1.27,1.14H6.62c-.45,0-.86-.21-1.09-.55-.12-.17-.29-.53-.11-.97l14.54-36.53c.18-.45.66-.76,1.2-.76Z"
            />
          </g>
        </svg>
      </div>

      {playMode !== "PLAY_OFF" && (
        <>

        {discardMode !== "DISCARD_OFF" && (
          <div className={styles.discardBoard}>
            <svg
              className={styles.yourPlayBoardSvg}
              viewBox="0 0 50 77.55"
              aria-hidden="true"
            >
              <g
                onDoubleClick={async () => {
                  if (!canDiscard) return;
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
                <path
                  className={styles.trapFill}
                  d="M7.04,73.69h36.63c.45,0,.86-.21,1.09-.55.12-.17.29-.53.11-.97l-14.54-36.53c-.18-.45-.66-.76-1.2-.76H7.04c-.7,0-1.27.51-1.27,1.14v36.53c0,.63.57,1.14,1.27,1.14Z"
                />
                <path
                  className={styles.trapStroke}
                  d="M43.68,76.33c1.32,0,2.55-.64,3.27-1.71.7-1.03.84-2.28.38-3.43l-14.54-36.53c-.58-1.45-2.04-2.42-3.65-2.42H7.04c-2.16,0-3.91,1.69-3.91,3.78v36.53c0,2.08,1.75,3.78,3.91,3.78h36.63ZM5.77,36.02c0-.63.57-1.14,1.27-1.14h22.09c.54,0,1.02.31,1.2.76l14.54,36.53c.18.44,0,.8-.11.97-.23.35-.64.55-1.09.55H7.04c-.7,0-1.27-.51-1.27-1.14v-36.53Z"
                />
              </g>
            </svg>
            <div className={styles.yourPlayBoardContent}>
              {topDiscard && <Card cardId={topDiscard} />}
              {canDiscard && (selected.length > 0 || playSelected.length > 0)
                ? " — double-click to discard & end turn"
                : ""}
            </div>
          </div>
        )}
        </>
      )}
      </section>

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

      <p>Cards remaining: {remaining}</p>

      {statusMessage && <p>{statusMessage}</p>}
    </main>
  );
}