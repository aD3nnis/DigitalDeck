"use client";

import type { DiscardMode, GameMode, PlayMode } from "./types";
import { useEffect, useState } from "react";
import { cardSrc, discardPileSrc, visualState } from "./CardAssets";
import Card from "./Card";
import styles from "./SessionScreen.module.css";
import Plyr1PlayBoard, { SLOT_IDS, type SlotId } from "./Plyr1PlayBoard";
import type { PlayArea } from "./types";
import GameTable from "./GameTable";


type Props = {
  roster: Record<string, string>;
  playerOrder: string[];
  playerId: string;
  gameMode: GameMode;
  currentTurn: string | null;
  hand: string[];
  remaining: number | null;
  discardMode: DiscardMode;
  playMode: PlayMode;
  topDiscard: string | null;
  onLeave: () => void;
  onDiscard: (cards: string[], source: "HAND" | "PLAY") => Promise<boolean>;
  statusMessage: string | null;
  onDraw: () => Promise<string | null>; // return drawn card, or null on fail
  onKeep: () => Promise<boolean>;
  playAreas: Record<string, PlayArea>;
  onPlay: (cards: string[], startSlot: SlotId) => Promise<boolean>;
  handCounts: Record<string, number>;
  
};

export default function SessionScreen({
  roster,
  playerOrder,
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
  handCounts,
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

  const [playSelected, setPlaySelected] = useState<SlotId[]>([]);
  const myPlayArea = playAreas[playerId];

  /** Returns [you, …clockwise others]. Length = roster size. */
  function seatsClockwiseFromMe(
    roster: Record<string, string>,
    me: string,
  ): string[] {
    const seats = Object.keys(roster);
    const myIndex = seats.findIndex((id) => id === me);
    if (myIndex === -1) return seats;
    // you last in current orderedSeats → flip so you are first (bottom)
    const after = seats.slice(myIndex + 1);
    const before = seats.slice(0, myIndex);
    return [me, ...after, ...before];
  }

  const toggle = (i: number) => {
    setSelected((prev) => {
      const at = prev.indexOf(i);
      if (at !== -1) return prev.filter((_, j) => j !== at);
      return [...prev, i];
    });
  };

  const [selected, setSelected] = useState<number[]>([]);
  const selectedCards = () => selected.map((i) => hand[i]);

  const selectedPlayCards = () =>
    playSelected.map((s) => (myPlayArea ?? {})[s]).filter(Boolean) as string[];
  
  const handleDrawDblClick = async () => {
    const card = await onDraw();
    if (!card) return;
    setPendingCard(card);
  };
  const togglePlaySlot = (id: SlotId) => {
    setPlaySelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
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

  const turnOrderIds =
    playerOrder.length > 0 ? playerOrder : Object.keys(roster);
  const playerCount = turnOrderIds.length;
  const [selectedSlot, setSelectedSlot] = useState<SlotId | null>(null);

function runFrom(start: SlotId, n: number): SlotId[] | null {
  const i = SLOT_IDS.indexOf(start);
  if (i < 0 || i + n > SLOT_IDS.length) return null;
  return SLOT_IDS.slice(i, i + n);
}

const handlePlace = async (id: SlotId) => {
  setSelectedSlot(id);
  if (!canPlay || selected.length === 0) return;
  const cards = selectedCards();
  const run = runFrom(id, cards.length);
  if (!run) {
    alert("not enough slots");
    return;
  }
  const occupied = myPlayArea ?? {};
  if (run.some((s) => occupied[s])) {
    alert("slot occupied");
    return;
  }
  const ok = await onPlay(cards, id);
  if (ok) {
    setSelected([]);
    setSelectedSlot(null);
  }
};
const [discardSelected, setDiscardSelected] = useState(false);

const handleDiscardActivate = async () => {
  if (!canDiscard || !discardSelected || selected.length === 0) return;
  const ok = await onDiscard(selectedCards(), "HAND");
  if (ok) {
    setSelected([]);
    setPendingCard(null);
    setDiscardSelected(false);
  }
};
  useEffect(() => {
    if (pendingCard == null) return;
    const idx = hand.lastIndexOf(pendingCard);
    if (idx !== -1) setSelected([idx]);
  }, [hand, pendingCard]);


  useEffect(() => {
    setPlaySelected([]);
  }, [myPlayArea]);


  useEffect(() => {
    if (gameMode !== "TURN_ROTATION") return;
    if (currentTurn === playerId) return;
    setSelected([]);
    setPendingCard(null);
    setDiscardSelected(false);
    setSelectedSlot(null);
    setPlaySelected([]);
    // setDrawSelected(false) once draw is lifted too
  }, [currentTurn, playerId, gameMode]);


  const drawDiscardSection = (
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

      {playMode !== "PLAY_OFF" && discardMode !== "DISCARD_OFF" && (
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
          <div className={styles.discardCardBoardContent}>
          {topDiscard && (
            <img src={discardPileSrc(topDiscard)} alt={topDiscard} />
          )}
          </div>
        </div>
      )}
    </section>
  );
  const myHandFan = (
    <ul className={styles.handCardUnorderedList}>
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
    </ul>
  );

  return (
    <main>
      <h1>Game</h1>

      <h2>Players</h2>


      {gameMode === "TURN_ROTATION" && (
        <p>
          Current turn: {currentTurn ? roster[currentTurn] ?? currentTurn : "—"}
          {currentTurn === playerId && " (this is you!)"}
        </p>
      )}
        <GameTable
          playerCount={turnOrderIds.length}
          turnOrderIds={turnOrderIds}
          viewerId={playerId}
          roster={roster}
          handBot={myHandFan}
          handCounts={handCounts}
          canDraw={canDraw}
          onDraw={handleDrawDblClick}
          canDiscard={canDiscard}
          discardSelected={discardSelected}
          onSelectDiscard={() => setDiscardSelected(true)}
          onDeselectDiscard={() => setDiscardSelected(false)}
          onDiscardActivate={handleDiscardActivate}
          topDiscard={topDiscard}
          myPlayArea={myPlayArea}
          selectedSlot={selectedSlot}
          playSelected={playSelected}
          onSelectEmptySlot={setSelectedSlot}
          onSelectOccupiedSlot={togglePlaySlot}
          onPlace={handlePlace}
        />
      <button onClick={onLeave}>Leave session</button>

      <p>Cards remaining: {remaining}</p>

      {statusMessage && <p>{statusMessage}</p>}
    </main>
  );
}