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

  const HAND_WIDTH = 350;
  const CARD_WIDTH = 80;
  const FAN_STEP = 15; // px between card origins
  const FAN_DEG = 3;
  const FAN_STEP_Y = 2;
    
  /** Centered fan: [-3,0], [-3,0,3], [-6,-3,0,3], … */
  function fanAngle(index: number, count: number): number {
    return (-Math.floor(count / 2) + index) * FAN_DEG;
  }

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


    const seats = Object.entries(roster); 
    const myIndex = seats.findIndex(([id]) => id === playerId);
    
    const orderedSeats =
    myIndex === -1
      ? seats
      : [...seats.slice(myIndex + 1), ...seats.slice(0, myIndex + 1)];
  
  
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
      <ul className={styles.playAreaUnorderedList}>
      {orderedSeats.map(([id, name]) => {
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
                <div className={styles.player2BoardTwoPlayerGame}>
                  <svg
                    className={styles.yourPlayBoardSvg}
                    viewBox="0 0 350 47.4"
                    aria-hidden="true"
                  >
                    <path
                      className={styles.trapFill}
                      d="M88.88,42.69c.07.15.36.66,1.03.66h170.27c.68,0,.96-.5,1.04-.66.07-.15.27-.7-.16-1.22l-30.87-36.78c-.22-.26-.54-.41-.87-.41h-108.66c-.34,0-.66.15-.88.41l-30.74,36.78c-.43.52-.23,1.06-.16,1.22Z"
                    />
                    <path
                      className={styles.trapStroke}
                      d="M89.91,45.98h170.27c1.48,0,2.8-.84,3.42-2.18.63-1.35.42-2.89-.53-4.03L232.21,2.99c-.72-.86-1.77-1.35-2.89-1.35h-108.66c-1.12,0-2.18.49-2.9,1.36l-30.74,36.78c-.95,1.14-1.15,2.68-.52,4.02.63,1.34,1.94,2.18,3.42,2.18ZM120.65,4.28h108.66c.34,0,.66.15.87.41l30.87,36.78c.43.52.23,1.06.16,1.22-.07.15-.36.66-1.04.66H89.91c-.67,0-.96-.5-1.03-.66-.07-.15-.27-.7.16-1.22L119.78,4.69c.22-.26.54-.41.88-.41Z"
                    />
                  </svg>
                  <div className={styles.yourPlayBoardContent}>
                    <ul className={styles.playCardUnorderedList}>
                      {area.length === 0 ? (
                        <li style={{ listStyle: "none" }}></li>
                      ) : (
                        area.map((card, i) => (
                          <li key={`${id}-${card}-${i}`} style={{ listStyle: "none" }}>
                            <Card cardId={card} />
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
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

      <ul className={styles.playAreaUnorderedList}>
        <div className={styles.handCardUnorderedList}>
        {hand.map((card, i) => {
          const order = selected.indexOf(i);
          const isSelected = order !== -1;
          const isPending = pendingIndex === i;
          const src = cardSrc(
            card,
            visualState({ selected: isSelected, pending: isPending }),
          );

          const n = hand.length;
          const fanWidth = CARD_WIDTH + Math.max(0, n - 1) * FAN_STEP;
          const originX = (HAND_WIDTH - fanWidth) / 2;
          const angle = fanAngle(i, n);

          const center = (n - 1) / 2;
          const drop = Math.abs(i - center) * FAN_STEP_Y; 

          return (
            <li
              key={`${card}-${i}`}
              className={styles.handCard}
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
              style={{
                left: originX + i * FAN_STEP,
                bottom: 8 - drop,
                transform: `rotate(${angle}deg)`,
                zIndex: i,
              }}
            >
              <img src={src} alt={card} width={CARD_WIDTH} />
              {isSelected && <span> ({order + 1})</span>}
            </li>
          );
        })}
        </div>
      </ul>

      <button onClick={onLeave}>Leave session</button>

      <p>Cards remaining: {remaining}</p>

      {statusMessage && <p>{statusMessage}</p>}
    </main>
  );
}