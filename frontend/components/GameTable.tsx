"use client";


import OpponentHand from "./OpponentHand";
import SelectablePileBoard from "./SelectablePileBoard";
import { LAYOUTS, screenPlayersBySeat, ABSOLUTE, type SeatKey } from "./tableLayouts";
import { discardPileSrc } from "./CardAssets";
import pileStyles from "./BoardInteraction.module.css";


import styles1 from "./OnePlayerTable.module.css";
import styles2 from "./TwoPlayerTable.module.css";
import styles3 from "./ThreePlayerTable.module.css";
import styles4 from "./FourPlayerTable.module.css";
import styles5 from "./FivePlayerTable.module.css";
import styles6 from "./SixPlayerTable.module.css";
import { useEffect, useState, type ReactNode } from "react";
import Plyr1PlayBoard, { type SlotId } from "./Plyr1PlayBoard";
import type { PlayArea } from "./types";
import sessionStyles from "./SessionScreen.module.css";

const STYLES = {
  1: styles1,
  2: styles2,
  3: styles3,
  4: styles4,
  5: styles5,
  6: styles6,
} as const;

type Props = {
  playerCount: number;
  turnOrderIds: string[];
  viewerId: string;
  roster: Record<string, string>;
  handBot?: ReactNode;
  handCounts?: Record<string, number>;
  canDraw?: boolean;
  onDraw?: () => void;
  canDiscard?: boolean;
  discardSelected?: boolean;
  onSelectDiscard?: () => void;
  onDeselectDiscard?: () => void;
  onDiscardActivate?: () => void;
  topDiscard?: string | null;
  myPlayArea?: PlayArea;
  selectedSlot?: SlotId | null;
  playSelected?: SlotId[];
  onSelectEmptySlot?: (id: SlotId) => void;
  onSelectOccupiedSlot?: (id: SlotId) => void;
  onPlace?: (id: SlotId) => void;
};


const HAND_CLASS: Record<string, string> = {
  handTop: "handTop",
  handTL: "handTL",
  handTR: "handTR",
  handL: "handL",
  handR: "handR",
};

const SEAT_CLASS: Record<SeatKey, string> = {
  top: "top",
  topLeft: "topLeft",
  topRight: "topRight",
  left: "left",
  right: "right",
  bottom: "bottom",
};

export default function GameTable({
  playerCount,
  turnOrderIds,
  viewerId,
  roster, // add this
  handBot,
  handCounts,
  canDraw = false,
  onDraw,
  canDiscard = false,
  discardSelected = false,
  onSelectDiscard,
  onDeselectDiscard,
  onDiscardActivate,
  topDiscard = null,
  myPlayArea,
  selectedSlot,
  playSelected,
  onSelectEmptySlot,
  onSelectOccupiedSlot,
  onPlace,
}: Props) {
  const [drawSelected, setDrawSelected] = useState(false);
  useEffect(() => {
    if (!canDraw) setDrawSelected(false);
  }, [canDraw]);

  const n = Math.min(6, Math.max(1, playerCount)) as 1 | 2 | 3 | 4 | 5 | 6;
  const styles = STYLES[n];
  const layout = LAYOUTS[n];

  const bySeat = screenPlayersBySeat(turnOrderIds, viewerId);
  
  const pidAt = (seat: SeatKey) => bySeat[seat];
  
  const countForSeat = (seat: SeatKey) => {
    const pid = pidAt(seat);
    return pid ? handCounts?.[pid] ?? 0 : 0;
  };
  
  const name = (seat: SeatKey, fallback: string) => {
    const pid = pidAt(seat);
    return pid ? roster[pid] ?? pid : fallback;
  };
  
  const seatNumber = (seat: SeatKey) => {
    const pid = pidAt(seat);
    if (!pid) return 0;
    // stable number = position in turn order (1..n), not screen position
    return turnOrderIds.indexOf(pid) + 1;
  };
  

  const board = (seat: SeatKey) => {
    const file = layout.boards[seat];
    if (!file) return null;
    const cls = SEAT_CLASS[seat];
    return (
      <div key={seat} className={`${styles.seat} ${styles[cls as keyof typeof styles]}`}>
        <span className={styles.playerLabel}>
          {name(seat, seat)} ({seatNumber(seat)})
        </span>
        <img
          className={styles.boardImg}
          src={`${layout.folder}/${file}`}
          alt={`${name(seat, seat)}'s board`}
          draggable={false}
        />
      </div>
    );
  };

  return (
    <div className={styles.table} aria-label={`${n} player table`}>
      {Object.entries(layout.hands).map(([slot, seat]) => (
        <div
          key={slot}
          className={styles[HAND_CLASS[slot] as keyof typeof styles]}
        >
          <OpponentHand
            seat={seat!}
            label={seat!}
            count={countForSeat(seat!)}
          />
        </div>
      ))}

      {board("top")}
      {board("topLeft")}
      {board("topRight")}

      <div className={styles.draw}>
        <SelectablePileBoard
          src="/board-parts/dealer-boards/draw-pile-board.svg"
          label="Draw pile"
          action={{
            canUse: canDraw,
            selected: drawSelected,
            onSelect: () => setDrawSelected(true),
            onDeselect: () => setDrawSelected(false),
            onActivate: () => onDraw?.(),
          }}
        />
      </div>
      <div className={styles.discard}>
        <div className={pileStyles.pileWrap}>
          <SelectablePileBoard
            src="/board-parts/dealer-boards/discard-pile-board.svg"
            label="Discard pile"
            action={{
              canUse: canDiscard,
              selected: discardSelected,
              onSelect: () => onSelectDiscard?.(),
              onDeselect: () => onDeselectDiscard?.(),
              onActivate: () => onDiscardActivate?.(),
            }}
          />
          {topDiscard && (
            <img
              className={pileStyles.discardTopCard}
              src={discardPileSrc(topDiscard)}
              alt={topDiscard}
              draggable={false}
            />
          )}
        </div>
      </div>

      {"handML" in styles && <div className={styles.handML} aria-hidden />}
      {"handMR" in styles && <div className={styles.handMR} aria-hidden />}

      <div className={`${styles.seat} ${styles.dealer}`}>
        <img
          className={styles.dealerImg}
          src="/board-parts/dealer-boards/dealer-board.svg"
          alt="Dealer board"
          draggable={false}
        />
      </div>

      {board("left")}
      {board("right")}
      <div className={`${styles.seat} ${styles.bottom}`}>
        <span className={styles.playerLabel}>
          {name("bottom", "bottom")} ({seatNumber("bottom")})
        </span>
        <div className={sessionStyles.yourPlayBoard}>
          <Plyr1PlayBoard
            occupied={myPlayArea ?? {}}
            selectedSlot={selectedSlot ?? null}
            playSelected={playSelected ?? []}
            onSelectEmpty={(id) => onSelectEmptySlot?.(id)}
            onSelectOccupied={(id) => onSelectOccupiedSlot?.(id)}
            onPlace={(id) => onPlace?.(id)}
          />
        </div>
      </div>

      <div className={styles.handBot}>{handBot}</div>
    </div>
  );
}