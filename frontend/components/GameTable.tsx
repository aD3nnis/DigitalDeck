"use client";

import { useState, type ReactNode } from "react";
import OpponentHand from "./OpponentHand";
import SelectablePileBoard from "./SelectablePileBoard";
import { LAYOUTS, type SeatKey } from "./tableLayouts";

import styles1 from "./OnePlayerTable.module.css";
import styles2 from "./TwoPlayerTable.module.css";
import styles3 from "./ThreePlayerTable.module.css";
import styles4 from "./FourPlayerTable.module.css";
import styles5 from "./FivePlayerTable.module.css";
import styles6 from "./SixPlayerTable.module.css";

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
  seatPlayerIds: string[];
  roster: Record<string, string>;
  handBot?: ReactNode;
  handCounts?: Record<string, number>;
  canDraw?: boolean;
  onDraw?: () => void;
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
  seatPlayerIds,
  roster,
  handBot,
  handCounts,
  canDraw = false,
  onDraw,
}: Props) {
  const [drawSelected, setDrawSelected] = useState(false);
  const n = Math.min(6, Math.max(1, playerCount)) as 1 | 2 | 3 | 4 | 5 | 6;
  const styles = STYLES[n];
  const layout = LAYOUTS[n];

  const order: SeatKey[] =
    n === 6
      ? ["bottom", "left", "topLeft", "top", "topRight", "right"]
      : n === 5
        ? ["bottom", "left", "topLeft", "topRight", "right"]
        : n === 4
          ? ["bottom", "left", "top", "right"]
          : n === 3
            ? ["bottom", "left", "right"]
            : n === 2
              ? ["bottom", "top"]
              : ["bottom"];

  const countForSeat = (seat: SeatKey) => {
    const i = order.indexOf(seat);
    const pid = i >= 0 ? seatPlayerIds[i] : undefined;
    if (!pid) return 0;
    return handCounts?.[pid] ?? 0;
  };

  const name = (seat: SeatKey, fallback: string) => {
    const i = order.indexOf(seat);
    const pid = i >= 0 ? seatPlayerIds[i] : undefined;
    return pid ? roster[pid] ?? pid : fallback;
  };
  

  const board = (seat: SeatKey) => {
    const file = layout.boards[seat];
    if (!file) return null;
    const cls = SEAT_CLASS[seat];
    const seatNumber = order.indexOf(seat) + 1; // 1–6
    return (
      <div key={seat} className={`${styles.seat} ${styles[cls as keyof typeof styles]}`}>
        <span className={styles.playerLabel}>
          {name(seat, seat)} ({seatNumber})
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
        <img
          className={styles.pileImg}
          src="/board-parts/dealer-boards/discard-pile-board.svg"
          alt="Discard pile"
          draggable={false}
        />
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
      {board("bottom")}

      <div className={styles.handBot}>{handBot}</div>
    </div>
  );
}