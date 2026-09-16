"use client";

import type { CSSProperties } from "react";
import styles from "./OpponentHand.module.css";
import type { SeatKey } from "./tableLayouts";

const HAND = "/cards-in-hand-spots";
const CARD_WIDTH = 34; // match .handBackImg width

type SeatFan = {
  mode: "centered" | "fromFirst";
  stepX: number;
  stepY: number;
  deg: number;
  baseDeg?: number; // first-card tilt (fromFirst)
  src: string;
};

const SEAT_FAN: Record<Exclude<SeatKey, "bottom">, SeatFan> = {
  top: {
    mode: "centered",
    stepX: 3,
    stepY: -0.5,
    deg: 3,
    src: `${HAND}/default/card-back-blue.svg`,
  },
  // sides: grow from first card (old behavior), still a fan
  topLeft: {
    mode: "fromFirst",
    stepX: 0.1 * 7,   // same idea as dx * STEP
    stepY: -0.3 * 7,
    deg: (-1) * -4,   // same idea as rot * DEG
    src: `${HAND}/plyrs-top-left-right/card-back-blue-left.svg`,
  },
  topRight: {
    mode: "fromFirst",
    stepX: -0.1 * 7,
    stepY: -0.3 * 7,
    deg: (1) * -4,
    src: `${HAND}/plyrs-top-left-right/card-back-blue-right.svg`,
  },
  left: {
    mode: "fromFirst",
    stepX: 0.1 * 7,
    stepY: -1.1 * 7,
    deg: 4,
    baseDeg: -8, // tweak
    src: `${HAND}/plyrs-bottom-left-right/card-back-blue-left.svg`,
  },
  right: {
    mode: "fromFirst",
    stepX: -0.1 * 7,
    stepY: -1.1 * 7,
    deg: -4,
    baseDeg: 8, // mirror of left
    src: `${HAND}/plyrs-bottom-left-right/card-back-blue-right.svg`,
  },
};

function fanOffset(index: number, count: number): number {
  return -Math.floor(count / 2) + index; // only for centered
}

function backStyle(i: number, count: number, fan: SeatFan): CSSProperties {
  if (fan.mode === "centered") {
    const k = fanOffset(i, count);
    const center = (count - 1) / 2;
    const drop = Math.abs(i - center) * fan.stepY;
    const fanWidth = CARD_WIDTH + Math.max(0, count - 1) * Math.abs(fan.stepX);
    const originX = -fanWidth / 2 + CARD_WIDTH / 2;

    return {
      transform: `translate(${originX + i * fan.stepX}px, ${-drop}px) rotate(${k * fan.deg}deg)`,
      zIndex: i,
    };
  }

  // fromFirst: card 0 stays put; i=1,2,… stack further (your old model)
  const angle = (fan.baseDeg ?? 0) + i * fan.deg;
  return {
    transform: `translate(${i * fan.stepX}px, ${i * fan.stepY}px) rotate(${angle}deg)`,
    zIndex: count - i,
  };
}

type Props = {
  seat: Exclude<SeatKey, "bottom">;
  count: number;
  label: string;
};

export default function OpponentHand({ seat, count, label }: Props) {
  const fan = SEAT_FAN[seat];
  const isUpright = seat === "top";
  if (count <= 0) return null;

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