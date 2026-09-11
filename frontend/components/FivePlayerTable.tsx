"use client";

import styles from "./FivePlayerTable.module.css";

const FOLDER = "/board-parts/five-player";

type Props = {
  /** Clockwise from you: [you, left, topLeft, topRight, right] */
  seatPlayerIds: string[];
  roster: Record<string, string>;
};

export default function FivePlayerTable({ seatPlayerIds, roster }: Props) {
  const name = (i: number, fallback: string) => {
    const pid = seatPlayerIds[i];
    return pid ? roster[pid] ?? pid : fallback;
  };

  return (
    <div className={styles.table} aria-label="Five player table">
      <div className={`${styles.seat} ${styles.topLeft}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-3-board-five-player-game.svg`}
          alt={`${name(2, "top-left")}'s board`}
          draggable={false}
        />
      </div>

      <div className={`${styles.seat} ${styles.topRight}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-4-board-five-player-game.svg`}
          alt={`${name(3, "top-right")}'s board`}
          draggable={false}
        />
      </div>

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

      <div className={`${styles.seat} ${styles.left}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-2-board-five-player-game.svg`}
          alt={`${name(1, "left")}'s board`}
          draggable={false}
        />
      </div>

      <div className={`${styles.seat} ${styles.right}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-5-board-five-player-game.svg`}
          alt={`${name(4, "right")}'s board`}
          draggable={false}
        />
      </div>

      <div className={`${styles.seat} ${styles.bottom}`}>
        <img
          className={styles.boardImg}
          src={`${FOLDER}/player-1-board-five-player-game.svg`}
          alt={`${name(0, "you")}'s board`}
          draggable={false}
        />
      </div>
    </div>
  );
}