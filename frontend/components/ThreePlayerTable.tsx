"use client";

import type { CSSProperties, ReactNode } from "react";
import styles from "./ThreePlayerTable.module.css";

const FOLDER = "/board-parts/three-player";
const HAND = "/cards-in-hand-spots";

/** Match your 4/5/6 test knobs */
const TEST_COUNT = 3;
const STEP = 7;
const DEG = -4;

type Props = {
  /** Clockwise from you: [you, left, right] */
  seatPlayerIds: string[];
  roster: Record<string, string>;
  handBot?: ReactNode;
};

const SEAT_FAN = {
  left: {
    dx: 0.1,
    dy: -1.1,
    rot: -1,
    src: `${HAND}/plyrs-bottom-left-right/card-back-blue-left.svg`,
  },
  right: {
    dx: -0.1,
    dy: -1.1,
    rot: 1,
    src: `${HAND}/plyrs-bottom-left-right/card-back-blue-right.svg`,
  },
} as const;

type SeatKey = keyof typeof SEAT_FAN;

function backStyle(
  i: number,
  count: number,
  fan: (typeof SEAT_FAN)[SeatKey],
): CSSProperties {
  const x = i * fan.dx * STEP;
  const y = i * fan.dy * STEP;
  const angle = i * fan.rot * DEG;
  return {
    transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`,
    zIndex: count - i,
  };
}

function OpponentHand({
  seat,
  count = TEST_COUNT,
  label,
}: {
  seat: SeatKey;
  count?: number;
  label: string;
}) {
  const fan = SEAT_FAN[seat];
  return (
    <div className={styles.opponentFan} aria-label={`${label} hand (${count})`}>
      {Array.from({ length: count }, (_, i) => (
        <img
          key={i}
          className={styles.handBackImg}
          src={fan.src}
          alt=""
          draggable={false}
          style={backStyle(i, count, fan)}
        />
      ))}
    </div>
  );
}

export default function ThreePlayerTable({
  seatPlayerIds,
  roster,
  handBot,
}: Props) {
  const name = (i: number, fallback: string) => {
    const pid = seatPlayerIds[i];
    return pid ? roster[pid] ?? pid : fallback;
  };

  return (
    <div className={styles.table} aria-label="Three player table">
      <div className={styles.draw}>
        <img
          className={styles.pileImg}
          src="/board-parts/dealer-boards/draw-pile-board.svg"
          alt="Draw pile"
          draggable={false}
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

      <div className={styles.handML} aria-hidden />
      <div className={styles.handMR} aria-hidden />

      <div className={`${styles.seat} ${styles.dealer}`}>
        <img
          className={styles.dealerImg}
          src="/board-parts/dealer-boards/dealer-board.svg"
          alt="Dealer board"
          draggable={false}
        />
      </div>

      <div className={styles.handL}>
        <OpponentHand seat="left" label="left" />
      </div>

      <div className={`${styles.seat} ${styles.left}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-2-board-three-player-game.svg`}
          alt={`${name(1, "left")}'s board`}
          draggable={false}
        />
      </div>

      <div className={`${styles.seat} ${styles.right}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-3-board-three-player-game.svg`}
          alt={`${name(2, "right")}'s board`}
          draggable={false}
        />
      </div>

      <div className={styles.handR}>
        <OpponentHand seat="right" label="right" />
      </div>

      <div className={`${styles.seat} ${styles.bottom}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-1-board-three-player-game.svg`}
          alt={`${name(0, "you")}'s board`}
          draggable={false}
        />
      </div>

      <div className={styles.handBot}>{handBot}</div>
    </div>
  );
}