"use client";

import type { ReactNode } from "react";
import styles from "./OnePlayerTable.module.css";

const FOLDER = "/board-parts/one-player";

type Props = {
  /** Clockwise from you: [you] */
  seatPlayerIds: string[];
  roster: Record<string, string>;
  handBot?: ReactNode;
};

export default function OnePlayerTable({
  seatPlayerIds,
  roster,
  handBot,
}: Props) {
  const name = (i: number, fallback: string) => {
    const pid = seatPlayerIds[i];
    return pid ? roster[pid] ?? pid : fallback;
  };

  return (
    <div className={styles.table} aria-label="One player table">
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

      <div className={`${styles.seat} ${styles.dealer}`}>
        <img
          className={styles.dealerImg}
          src="/board-parts/dealer-boards/dealer-board.svg"
          alt="Dealer board"
          draggable={false}
        />
      </div>

      <div className={`${styles.seat} ${styles.bottom}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-1-board-one-player-game.svg`}
          alt={`${name(0, "you")}'s board`}
          draggable={false}
        />
      </div>

      <div className={styles.handBot}>{handBot}</div>
    </div>
  );
}