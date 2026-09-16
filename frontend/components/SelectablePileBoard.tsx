"use client";

import { useEffect, useState } from "react";
import styles from "./BoardInteraction.module.css";
import { boardPointerProps, type BoardAction } from "./boardInteraction";

type Props = {
  /** e.g. /board-parts/dealer-boards/draw-pile-board.svg */
  src: string;
  action: BoardAction;
  label?: string;
};

export default function SelectablePileBoard({ src, action, label }: Props) {
  const [markup, setMarkup] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((r) => r.text())
      .then((text) => {
        if (cancelled) return;
        const inner = text
          .replace(/^[\s\S]*?<svg[^>]*>/i, "")
          .replace(/<\/svg>[\s\S]*$/i, "");
        setMarkup(inner);
      })
      .catch(() => {
        if (!cancelled) setMarkup("");
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const pointer = boardPointerProps(action);

  return (
    <svg
      viewBox="0 0 44.46 44.08"
      className={`${styles.pileSvg}${pointer.className ? ` ${pointer.className}` : ""}`}
      style={pointer.style}
      onClick={pointer.onClick}
      onDoubleClick={pointer.onDoubleClick}
      aria-label={label ?? "pile"}
      dangerouslySetInnerHTML={markup ? { __html: markup } : undefined}
    />
  );
}