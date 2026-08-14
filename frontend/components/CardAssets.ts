export type CardVisualState =
  | "default"
  | "selected"
  | "drawn-last"
  | "drawn-last-selected";

export function cardSrc(cardId: string, state: CardVisualState): string {
  switch (state) {
    case "selected":
      return `/card-states/selected/suits-selected_${cardId}.svg`;
    case "drawn-last":
      return `/card-states/drawn-last/drawn-last_${cardId}.svg`;
    case "drawn-last-selected":
      return `/card-states/drawn-last-selected/suits-drawn-last-selected_${cardId}.svg`;
    default:
      return `/card-states/default/default_${cardId}.svg`;
  }
}
export function discardPileSrc(cardId: string): string {
    return `/played-card-spots/discard-pile/default_${cardId}.svg`;
  }
export function visualState(opts: {
    selected: boolean;
    pending: boolean;
  }): CardVisualState {
    if (opts.pending && opts.selected) return "drawn-last-selected";
    if (opts.pending) return "drawn-last";
    if (opts.selected) return "selected";
    return "default";
  }

  export function playedSpotSrc(
    seat: "plyr-bottom-center" | "plyr-top-center",
    slotId: string,
    cardId: string,
  ): string {
    const row = slotId.startsWith("t") ? "top-row" : "bottom-row";
    return `/played-card-spots/${seat}/${row}/${slotId}/default_${cardId}.svg`;
  }