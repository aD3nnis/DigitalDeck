import type { SlotId } from "./Plyr1PlayBoard";

export type PlayArea = Partial<Record<SlotId, string>>;
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

export type PlayMode = "PLAY_OFF" | "TURN_PLAY" | "FREE_PLAY";

export function isPlayModeAllowed(gameMode: GameMode, playMode: PlayMode): boolean {
  if (gameMode === "FREE_ROTATION" && playMode === "TURN_PLAY") return false;
  return true;
}

export function coercePlayMode(gameMode: GameMode, playMode: PlayMode): PlayMode {
  return isPlayModeAllowed(gameMode, playMode) ? playMode : "PLAY_OFF";
}