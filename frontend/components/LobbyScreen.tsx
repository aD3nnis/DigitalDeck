"use client";

import type { DiscardMode, GameMode } from "./types";

type Props = {
  code: string | null;
  roster: Record<string, string>;
  playerId: string;
  hostId: string | null;
  gameMode: GameMode;
  discardMode: DiscardMode;
  onUpdateGameMode: (mode: GameMode) => void;
  onUpdateDiscardMode: (mode: DiscardMode) => void;
  onStart: () => void;
  onLeave: () => void;
};

export default function LobbyScreen({
  code,
  roster,
  playerId,
  hostId,
  gameMode,
  discardMode,
  onUpdateGameMode,
  onUpdateDiscardMode,
  onStart,
  onLeave,

}: Props) {
  const isHost = playerId === hostId;

  return (
    <main>
      <h1>Lobby</h1>
      {code && <p>Session code: {code}</p>}

      <h2>Players</h2>
      <ul>
        {Object.entries(roster).map(([id, name]) => (
          <li key={id}>
            {name} <small>({id})</small>
            {id === hostId && " — host"}
          </li>
        ))}
      </ul>

      {isHost ? (
        <section>
          <label>
            <input
              type="radio"
              name="gameMode"
              checked={gameMode === "TURN_ROTATION"}
              onChange={() => onUpdateGameMode("TURN_ROTATION")}
            />
            Turn Rotation
          </label>
          <label>
            <input
              type="radio"
              name="gameMode"
              checked={gameMode === "FREE_ROTATION"}
              onChange={() => onUpdateGameMode("FREE_ROTATION")}
            />
            Free Rotation
          </label>
        </section>
        
      ) : (
        <p>
          Mode:{" "}
          {gameMode === "TURN_ROTATION" ? "Turn Rotation" : "Free Rotation"}
        </p>
        
      )}
      {isHost? (      <section>
        <label>
          <input
            type="radio"
            name="discardMode"
            checked={discardMode === "DISCARD_OFF"}
            onChange={() => onUpdateDiscardMode("DISCARD_OFF")}
          />
          Discard Off
        </label>
        {gameMode === "TURN_ROTATION" && (
          <label>
            <input
              type="radio"
              name="discardMode"
              checked={discardMode === "TURN_DISCARD"}
              onChange={() => onUpdateDiscardMode("TURN_DISCARD")}
            />
            Turn Discard
          </label>
        )}
        <label>
          <input
            type="radio"
            name="discardMode"
            checked={discardMode === "FREE_DISCARD"}
            onChange={() => onUpdateDiscardMode("FREE_DISCARD")}
          />
          Free Discard
        </label>
      </section>) : (
        <p>
          Discard Mode:{" "}
          {discardMode === "DISCARD_OFF" ? "Discard Off" : discardMode === "TURN_DISCARD" ? "Turn Discard" : "Free Discard"}
        </p>
      )}

      {isHost && <button onClick={onStart}>Start game</button>}
      <button onClick={onLeave}>Leave session</button>
    </main>
  );
}