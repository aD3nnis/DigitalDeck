"use client";

import styles from "./SixPlayerTable.module.css";

const FOLDER = "/board-parts/six-player";

/** Seat index 0 = you (bottom). Clockwise after that. */
const SEATS = [
  {
    seat: 1,
    area: "bottom",
    src: `${FOLDER}/player-1-board-six-player-game.svg`,
    label: "you",
  },
  {
    seat: 2,
    area: "left",
    src: `${FOLDER}/player-2-board-six-player-game.svg`,
    label: "left",
  },
  {
    seat: 3,
    area: "topLeft",
    src: `${FOLDER}/player-3-board-six-player-game.svg`,
    label: "top-left",
  },
  {
    seat: 4,
    area: "top",
    src: `${FOLDER}/player-4-board-six-player-game.svg`,
    label: "top",
  },
  {
    seat: 5,
    area: "topRight",
    src: `${FOLDER}/player-5-board-six-player-game.svg`,
    label: "top-right",
  },
  {
    seat: 6,
    area: "right",
    src: `${FOLDER}/player-6-board-six-player-game.svg`,
    label: "right",
  },
] as const;

type Props = {
  /** Clockwise from you: [you, next, …] — length 6 for this shell */
  seatPlayerIds: string[];
  roster: Record<string, string>;
};

export default function SixPlayerTable({ seatPlayerIds, roster }: Props) {
    return (
      <div className={styles.table} aria-label="Six player table">
        <div className={`${styles.seat} ${styles.top}`}>
          <img className={styles.boardImg} src={`${FOLDER}/player-4-board-six-player-game.svg`} alt="top" />
        </div>
  
        <div className={`${styles.seat} ${styles.topLeft}`}>
          <img className={styles.boardImg} src={`${FOLDER}/player-3-board-six-player-game.svg`} alt="top-left" />
        </div>
        <div className={`${styles.seat} ${styles.topRight}`}>
          <img className={styles.boardImg} src={`${FOLDER}/player-5-board-six-player-game.svg`} alt="top-right" />
        </div>
  
        <div className={styles.draw}>
          <img className={styles.pileImg} src="/board-parts/dealer-boards/draw-pile-board.svg" alt="Draw pile" />
        </div>
        <div className={styles.discard}>
          <img className={styles.pileImg} src="/board-parts/dealer-boards/discard-pile-board.svg" alt="Discard pile" />
        </div>
  
        <div className={`${styles.seat} ${styles.dealer}`}>
          <img className={styles.dealerImg} src="/board-parts/dealer-boards/dealer-board.svg" alt="Dealer board" />
        </div>
  
        <div className={`${styles.seat} ${styles.left}`}>
          <img className={styles.boardImg} src={`${FOLDER}/player-2-board-six-player-game.svg`} alt="left" />
        </div>
        <div className={`${styles.seat} ${styles.right}`}>
          <img className={styles.boardImg} src={`${FOLDER}/player-6-board-six-player-game.svg`} alt="right" />
        </div>
  
        <div className={`${styles.seat} ${styles.bottom}`}>
          <img className={styles.boardImg} src={`${FOLDER}/player-1-board-six-player-game.svg`} alt="you" />
        </div>
      </div>
    );
  }