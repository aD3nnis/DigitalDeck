"use client";

import type { CSSProperties } from "react";
import styles from "./OpponentHand.module.css";
import type { SeatKey } from "./tableLayouts";

const HAND = "/cards-in-hand-spots";

/** Swap for real handCounts later */
export const TEST_HAND_COUNT = 3;
const STEP = 7;
const DEG = -4;

const SEAT_FAN: Record<
  Exclude<SeatKey, "bottom">,
  { dx: number; dy: number; rot: number; src: string }
> = {
  top: {
    dx: -0.5,
    dy: 0,
    rot: 1,
    src: `${HAND}/default/card-back-blue.svg`,
  },
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
};

function backStyle(
  i: number,
  count: number,
  fan: (typeof SEAT_FAN)[Exclude<SeatKey, "bottom">],
): CSSProperties {
  return {
    transform: `translate(${i * fan.dx * STEP}px, ${i * fan.dy * STEP}px) rotate(${i * fan.rot * DEG}deg)`,
    zIndex: count - i,
  };
}

type Props = {
  seat: Exclude<SeatKey, "bottom">;
  count?: number;
  label: string;
};

export default function OpponentHand({
  seat,
  count = TEST_HAND_COUNT,
  label,
}: Props) {
  const fan = SEAT_FAN[seat];
  const isUpright = seat === "top";

  return (
    <div
      className={`${styles.opponentFan} ${isUpright ? styles.upright : styles.warped}`}
      aria-label={`${label} hand (${count})`}
    >
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