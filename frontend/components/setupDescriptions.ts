import type { DiscardMode, GameMode, PlayMode } from "./types";

/** Short blurb for the selected draw / turn mode, given discard (what ends the turn). */
export function describeGameMode(
  gameMode: GameMode,
  discardMode: DiscardMode
): string {
  if (gameMode === "FREE_ROTATION") {
    return "No turn order — anyone can draw anytime.";
  }
  if (discardMode === "TURN_DISCARD") {
    return "Players take turns. Only the current player can draw; discarding ends the turn.";
  }
  return "Players take turns. Only the current player can draw; drawing ends the turn.";
}

/** Short blurb for the selected discard mode. */
export function describeDiscardMode(
  gameMode: GameMode,
  discardMode: DiscardMode
): string {
  switch (discardMode) {
    case "DISCARD_OFF":
      return "Discarding is disabled.";
    case "TURN_DISCARD":
      return "Only the current player can discard. Discarding ends their turn.";
    case "FREE_DISCARD":
      return gameMode === "TURN_ROTATION"
        ? "Anyone can discard anytime. Discarding does not end the turn."
        : "Anyone can discard anytime.";
  }
}

/** Short blurb for the selected play mode. Play never ends the turn. */
export function describePlayMode(playMode: PlayMode): string {
  switch (playMode) {
    case "PLAY_OFF":
      return "Playing cards to the table is disabled.";
    case "TURN_PLAY":
      return "Only the current player can play cards to the table. Playing does not end the turn.";
    case "FREE_PLAY":
      return "Anyone can play cards to the table anytime. Playing does not end the turn.";
  }
}

/** One-line summary of how the full combo behaves. */
export function describeSetup(
  gameMode: GameMode,
  discardMode: DiscardMode,
  playMode: PlayMode
): string {
  const parts: string[] = [];

  if (gameMode === "FREE_ROTATION") {
    parts.push("Anyone can draw anytime.");
  } else if (discardMode === "TURN_DISCARD") {
    parts.push("On your turn you may draw (drawing does not end the turn).");
  } else {
    parts.push("On your turn you may draw; drawing ends your turn.");
  }

  if (discardMode === "TURN_DISCARD") {
    parts.push("Discard to end your turn.");
  } else if (discardMode === "FREE_DISCARD") {
    parts.push("Anyone can discard anytime.");
  }

  if (playMode === "TURN_PLAY") {
    parts.push(
      "On your turn you may play cards to the table (does not end the turn)."
    );
  } else if (playMode === "FREE_PLAY") {
    parts.push("Anyone can play cards to the table anytime.");
  }

  return parts.join(" ");
}
