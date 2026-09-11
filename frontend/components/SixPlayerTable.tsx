"use client";

import type { ReactNode } from "react";
import styles from "./SixPlayerTable.module.css";

const FOLDER = "/board-parts/six-player";
const HAND = "/cards-in-hand-spots";

type Props = {
  seatPlayerIds: string[];
  roster: Record<string, string>;
  /** Your interactive hand — rendered in handBot */
  handBot?: ReactNode;
};

function TestBack({ src, alt }: { src: string; alt: string }) {
  return (
    <img className={styles.handBackImg} src={src} alt={alt} draggable={false} />
  );
}

export default function SixPlayerTable({ handBot }: Props) {
  return (
    <div className={styles.table} aria-label="Six player table">
      <div className={styles.handTop}>
        <TestBack src={`${HAND}/default/card-back-blue.svg`} alt="top hand" />
      </div>

      <div className={styles.handTL}>
        <TestBack
          src={`${HAND}/plyrs-top-left-right/card-back-blue-left.svg`}
          alt="top-left hand"
        />
      </div>
      <div className={styles.handTR}>
        <TestBack
          src={`${HAND}/plyrs-top-left-right/card-back-blue-right.svg`}
          alt="top-right hand"
        />
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
        <TestBack
          src={`${HAND}/plyrs-bottom-left-right/card-back-blue-left.svg`}
          alt="left hand"
        />
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
        <TestBack
          src={`${HAND}/plyrs-bottom-left-right/card-back-blue-right.svg`}
          alt="right hand"
        />
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