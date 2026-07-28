export type GameMode = "TURN_ROTATION" | "FREE_ROTATION";
export type DiscardMode = "DISCARD_OFF" | "TURN_DISCARD" | "FREE_DISCARD";

export function isDiscardModeAllowed(
  gameMode: GameMode,
  discardMode: DiscardMode
): boolean {
  if (gameMode === "FREE_ROTATION" && discardMode === "TURN_DISCARD") {
    return false;
  }
  return true;
}

export function coerceDiscardMode(
  gameMode: GameMode,
  discardMode: DiscardMode
): DiscardMode {
  return isDiscardModeAllowed(gameMode, discardMode)
    ? discardMode
    : "DISCARD_OFF";
}