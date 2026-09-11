"use client";

import type { CSSProperties, ReactNode } from "react";
import styles from "./SixPlayerTable.module.css";

const FOLDER = "/board-parts/six-player";
const HAND = "/cards-in-hand-spots";

/** Hardcoded for layout testing — swap for real handCounts later */
const TEST_COUNT = 3;
const STEP = 7; // px between card origins
const DEG = -4;
//translate(3px, -10px) rotate(-8deg);
type Props = {
  seatPlayerIds: string[];
  roster: Record<string, string>;
  handBot?: ReactNode;
};

/**
 * Fan direction unit vector toward dealer/center + rotation sign.
 * i=0 oldest (front); newer cards step along (dx, dy) and tuck behind.
 */
const SEAT_FAN = {
  top: { dx: -.5, dy: 0, rot: 1, src: `${HAND}/default/card-back-blue.svg` },
  topLeft: {
    dx: 0.1,
    dy: -0.5,
    rot: -1,
    src: `${HAND}/plyrs-top-left-right/card-back-blue-left.svg`,
  },
  topRight: {
    dx: -0.1,
    dy: -0.5,
    rot: 1,
    src: `${HAND}/plyrs-top-left-right/card-back-blue-right.svg`,
  },
  left: {
    dx: .1,
    dy: -1.1,
    rot: -1,
    src: `${HAND}/plyrs-bottom-left-right/card-back-blue-left.svg`,
  },
  right: {
    dx: -.1,
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
    zIndex: count - i, // oldest on top
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

export default function SixPlayerTable({ handBot }: Props) {
  return (
    <div className={styles.table} aria-label="Six player table">
      <div className={styles.handTop}>
        <OpponentHand seat="top" label="top" />
      </div>

      <div className={styles.handTL}>
        <OpponentHand seat="topLeft" label="top-left" />
      </div>
      <div className={styles.handTR}>
        <OpponentHand seat="topRight" label="top-right" />
      </div>

      <div className={`${styles.seat} ${styles.top}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-4-board-six-player-game.svg`}
          alt="top"
        />
      </div>

      <div className={`${styles.seat} ${styles.topLeft}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-3-board-six-player-game.svg`}
          alt="top-left"
        />
      </div>
      <div className={`${styles.seat} ${styles.topRight}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-5-board-six-player-game.svg`}
          alt="top-right"
        />
      </div>

      <div className={styles.draw}>
        <img
          className={styles.pileImg}
          src="/board-parts/dealer-boards/draw-pile-board.svg"
          alt="Draw pile"
        />
      </div>
      <div className={styles.discard}>
        <img
          className={styles.pileImg}
          src="/board-parts/dealer-boards/discard-pile-board.svg"
          alt="Discard pile"
        />
      </div>

      <div className={styles.handML} aria-hidden />
      <div className={styles.handMR} aria-hidden />

      <div className={`${styles.seat} ${styles.dealer}`}>
        <img
          className={styles.dealerImg}
          src="/board-parts/dealer-boards/dealer-board.svg"
          alt="Dealer board"
        />
      </div>

      <div className={styles.handL}>
        <OpponentHand seat="left" label="left" />
      </div>
      <div className={`${styles.seat} ${styles.left}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-2-board-six-player-game.svg`}
          alt="left"
        />
      </div>
      <div className={`${styles.seat} ${styles.right}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-6-board-six-player-game.svg`}
          alt="right"
        />
      </div>
      <div className={styles.handR}>
        <OpponentHand seat="right" label="right" />
      </div>

      <div className={`${styles.seat} ${styles.bottom}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-1-board-six-player-game.svg`}
          alt="you"
        />
      </div>

      <div className={styles.handBot}>{handBot}</div>
    </div>
  );
}