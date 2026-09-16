import type { CSSProperties, MouseEvent } from "react";

export type BoardAction = {
  canUse: boolean;
  selected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onActivate: () => void;
};

// boardInteraction.ts — replace boardPointerProps click handling

let clickTimer: ReturnType<typeof setTimeout> | null = null;
let clicks = 0;

export function boardPointerProps(action: BoardAction) {
  return {
    className: action.selected ? "selected" : undefined,
    style: { cursor: action.canUse ? "pointer" : undefined },
    onClick: () => {
      if (!action.canUse) return;

      clicks += 1;
      if (clicks === 1) {
        clickTimer = setTimeout(() => {
          clicks = 0;
          clickTimer = null;
          // single click: toggle select
          if (action.selected) action.onDeselect();
          else action.onSelect();
        }, 250);
      } else if (clicks === 2) {
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = null;
        clicks = 0;
        // double click: draw (no toggle)
        action.onActivate();
      }
    },
    // optional: block text-select flash
    onDoubleClick: (e: React.MouseEvent) => e.preventDefault(),
  };
}