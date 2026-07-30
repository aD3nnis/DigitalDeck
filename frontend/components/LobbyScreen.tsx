"use client";

import type { DiscardMode, GameMode, PlayMode } from "./types";

type Props = {
  code: string | null;
  roster: Record<string, string>;
  playerId: string;
  hostId: string | null;
  gameMode: GameMode;
  discardMode: DiscardMode;
  playMode: PlayMode;
  deckCount: number;
  cardsPerPlayer: number;
  onUpdateGameMode: (mode: GameMode) => void;
  onUpdateDiscardMode: (mode: DiscardMode) => void;
  onUpdatePlayMode: (mode: PlayMode) => void;
  onUpdateDeckCount: (count: number) => void;
  onUpdateCardsPerPlayer: (count: number) => void;
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
  deckCount,
  cardsPerPlayer,
  playMode,
  onUpdateGameMode,
  onUpdateDiscardMode,
  onUpdatePlayMode,
  onUpdateDeckCount,
  onUpdateCardsPerPlayer,
  onStart,
  onLeave,
}: Props) {
  const isHost = playerId === hostId;
  const playerCount = Object.keys(roster).length;
  const needed = playerCount * cardsPerPlayer;
  const available = deckCount * 52;
  const canStart = needed <= available;

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
      {isHost ? (
        <section>
          <label>
            <input
              type="radio"
              name="playMode"
              checked={playMode === "PLAY_OFF"}
              onChange={() => onUpdatePlayMode("PLAY_OFF")}
            />
            Play Off
          </label>
          {gameMode === "TURN_ROTATION" && (
            <label>
              <input
                type="radio"
                name="playMode"
                checked={playMode === "TURN_PLAY"}
                onChange={() => onUpdatePlayMode("TURN_PLAY")}
              />
              Turn Play
            </label>
          )}
          <label>
            <input
              type="radio"
              name="playMode"
              checked={playMode === "FREE_PLAY"}
              onChange={() => onUpdatePlayMode("FREE_PLAY")}
            />
            Free Play
          </label>
        </section>
      ) : (
        <p>
          Play Mode:{" "}
          {playMode === "PLAY_OFF"
            ? "Play Off"
            : playMode === "TURN_PLAY"
              ? "Turn Play"
              : "Free Play"}
        </p>
      )}
      {isHost ? (
        <section>
          <p>Decks</p>
          {[1, 2, 3].map((n) => (
            <label key={n}>
              <input
                type="radio"
                name="deckCount"
                checked={deckCount === n}
                onChange={() => onUpdateDeckCount(n)}
              />
              {n}
            </label>
          ))}
        </section>
      ) : (
        <p>Decks: {deckCount}</p>
      )}
            {isHost ? (
        <section>
          <label>
            Cards each at start:{" "}
            <input
              type="number"
              min={0}
              max={52}
              value={cardsPerPlayer}
              onChange={(e) =>
                onUpdateCardsPerPlayer(Number(e.target.value) || 0)
              }
            />
          </label>
          <p>
            Need {needed} / {available} cards
            {!canStart && " — lower cards each, add a deck, or wait for fewer players"}
          </p>
        </section>
      ) : (
        <p>Cards each at start: {cardsPerPlayer}</p>
      )}
      {isHost && (
        <button onClick={onStart} disabled={!canStart}>
          Start game
        </button>
      )}

      <button onClick={onLeave}>Leave session</button>
    </main>
  );
}