"use client";

import type { DiscardMode, GameMode } from "./types";


type Props = {
  displayName: string;
  joinCodeInput: string;
  gameMode: GameMode;
  clientReady: boolean;
  discardMode: DiscardMode;
  onDisplayNameChange: (name: string) => void;
  onJoinCodeChange: (code: string) => void;
  onGameModeChange: (mode: GameMode) => void;
  onCreate: () => void;
  onJoin: () => void;
  onDiscardModeChange: (mode: DiscardMode) => void;
};

export default function HomeScreen({
  displayName,
  joinCodeInput,
  gameMode,
  clientReady,
  onDisplayNameChange,
  onJoinCodeChange,
  onGameModeChange,
  onCreate,
  onJoin,
  discardMode,
  onDiscardModeChange,
}: Props) {
  return (
    <main>
      <h1>DigitalDeck</h1>

      <section>
        <input
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder="Your name"
        />
      </section>

      <section>
        <label>
          <input
            type="radio"
            name="gameMode"
            checked={gameMode === "TURN_ROTATION"}
            onChange={() => onGameModeChange("TURN_ROTATION")}
          />
          Turn Rotation
        </label>
        <label>
          <input
            type="radio"
            name="gameMode"
            checked={gameMode === "FREE_ROTATION"}
            onChange={() => onGameModeChange("FREE_ROTATION")}
          />
          Free Rotation
        </label>
      </section>

      <section>
        <label>
          <input
            type="radio"
            name="discardMode"
            checked={discardMode === "DISCARD_OFF"}
            onChange={() => onDiscardModeChange("DISCARD_OFF")}
          />
          Discard Off
        </label>

        {gameMode === "TURN_ROTATION" && (
          <label>
            <input
              type="radio"
              name="discardMode"
              checked={discardMode === "TURN_DISCARD"}
              onChange={() => onDiscardModeChange("TURN_DISCARD")}
            />
            Turn Discard
          </label>
        )}

        <label>
          <input
            type="radio"
            name="discardMode"
            checked={discardMode === "FREE_DISCARD"}
            onChange={() => onDiscardModeChange("FREE_DISCARD")}
          />
          Free Discard
        </label>
      </section>

      <section>
        <button onClick={onCreate} disabled={!clientReady || !displayName}>
          Create Session
        </button>
      </section>

      <section>
        <input
          value={joinCodeInput}
          onChange={(e) => onJoinCodeChange(e.target.value)}
          placeholder="Enter code"
        />
        <button
          onClick={onJoin}
          disabled={!clientReady || !displayName || !joinCodeInput}
        >
          Join session
        </button>
      </section>
    </main>
  );
}