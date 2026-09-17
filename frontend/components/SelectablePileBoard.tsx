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

/** Filename without .svg — used to scope Illustrator .cls-* rules per instance. */
function pileScopeFromSrc(src: string): string {
  const file = src.split("/").pop() ?? "pile";
  return file.replace(/\.svg$/i, "");
}

/**
 * Inlined SVGs share one document, so unscoped `.cls-3 { fill }` from draw vs
 * discard collide. Rewrite style selectors under [data-pile="…"]; leave path
 * class names unchanged so exports stay readable.
 */
function scopeSvgStyles(markup: string, scope: string): string {
  return markup.replace(
    /<style(\s[^>]*)?>([\s\S]*?)<\/style>/gi,
    (_match, attrs: string | undefined, css: string) => {
      const scoped = css.replace(/\.cls-(\d+)/g, `[data-pile="${scope}"] .cls-$1`);
      return `<style${attrs ?? ""}>${scoped}</style>`;
    },
  );
}

export default function SelectablePileBoard({ src, action, label }: Props) {
  const [markup, setMarkup] = useState("");
  const scope = pileScopeFromSrc(src);

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((r) => r.text())
      .then((text) => {
        if (cancelled) return;
        const inner = text
          .replace(/^[\s\S]*?<svg[^>]*>/i, "")
          .replace(/<\/svg>[\s\S]*$/i, "");
        setMarkup(scopeSvgStyles(inner, scope));
      })
      .catch(() => {
        if (!cancelled) setMarkup("");
      });
    return () => {
      cancelled = true;
    };
  }, [src, scope]);

  const pointer = boardPointerProps(action);

  return (
    <svg
      data-pile={scope}
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
