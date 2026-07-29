"use client";

import { useEffect, useRef, useState } from "react";
import { Client, StompSubscription } from "@stomp/stompjs";
import HomeScreen from "../components/HomeScreen";
import LobbyScreen from "../components/LobbyScreen";
import SessionScreen from "../components/SessionScreen";
import type { DiscardMode, GameMode } from "../components/types";
import { coerceDiscardMode } from "../components/types";


export default function Home() {
  const [messages, setMessages] = useState<string[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [roster, setRoster] = useState<Record<string, string>>({});
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [hand, setHand] = useState<string[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [gameMode, setGameMode] = useState<"TURN_ROTATION" | "FREE_ROTATION">("TURN_ROTATION");
  const [discardMode, setDiscardMode] = useState<DiscardMode>("DISCARD_OFF");
  const [topDiscard, setTopDiscard] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [cardsPerPlayer, setCardsPerPlayer] = useState(0);
  const handleGameModeChange = (next: GameMode) => {
    setGameMode(next);
    setDiscardMode((prev) => coerceDiscardMode(next, prev));
  };
  const [deckCount, setDeckCount] = useState(1);

  useEffect(() => {
    if (!statusMessage) return;
    const id = setTimeout(() => setStatusMessage(null), 4000);
    return () => clearTimeout(id);
  }, [statusMessage]);

  const [displayName, setDisplayName] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("digitalDeck.displayName") ?? "";
  });

  const [playerId] = useState(() => {
    if (typeof window === "undefined") return "";
    const stored = sessionStorage.getItem("digitalDeck.playerId");
    if (stored) return stored;
    const newId = crypto.randomUUID();
    sessionStorage.setItem("digitalDeck.playerId", newId);
    return newId;
  });

  const sessionSubscriptionRef = useRef<StompSubscription | null>(null);

  useEffect(() => {
    const stompClient = new Client({
      brokerURL: "ws://localhost:8080/ws",
      onConnect: () => {
        setClient(stompClient);

        const savedSessionId = sessionStorage.getItem("digitalDeck.sessionId");
        const savedName = sessionStorage.getItem("digitalDeck.displayName");
        if (savedSessionId && savedName) {
          setDisplayName(savedName);
          setSessionId(savedSessionId);
          subscribeAndJoin(savedSessionId, stompClient);
          rehydrateHand(savedSessionId);
        }
      },
    });

    stompClient.activate();
    return () => {
      sessionSubscriptionRef.current?.unsubscribe();
      sessionSubscriptionRef.current = null;
      stompClient.deactivate();
    };
  }, []);

  const subscribeAndJoin = (resolvedSessionId: string, stompClient: Client) => {
    if (sessionId === resolvedSessionId) return;

    sessionSubscriptionRef.current?.unsubscribe();
    sessionSubscriptionRef.current = null;

    sessionSubscriptionRef.current = stompClient.subscribe(
      `/topic/session/${resolvedSessionId}`,
      (message) => {
        const event = JSON.parse(message.body);
        if (event.type === "ROSTER") {
          setRoster(event.payload);
        } else if (event.type === "HOST_CHANGED") {
          setHostId(event.payload.playerId);
        } else if (event.type === "DECK_INITIALIZED") {
          setGameStarted(true);
          setRemaining(event.payload.remaining);
          if (event.payload.gameMode) setGameMode(event.payload.gameMode);
          if (event.payload.cardsPerPlayer != null) {
            setCardsPerPlayer(event.payload.cardsPerPlayer);
          }
          rehydrateHand(resolvedSessionId); // dealt hands land here
        } else if (event.type === "GAME_STATE") {
          setGameStarted(event.payload.gameStarted);
          setRemaining(event.payload.remaining);
          setCurrentTurn(event.payload.currentTurn);
          if (event.payload.gameMode) setGameMode(event.payload.gameMode);
          if (event.payload.discardMode) setDiscardMode(event.payload.discardMode);
          setTopDiscard(event.payload.topDiscard ?? null);
          if (event.payload.deckCount != null) setDeckCount(event.payload.deckCount);
          if (event.payload.cardsPerPlayer != null) {
            setCardsPerPlayer(event.payload.cardsPerPlayer);
          }
          if (event.payload.gameStarted) {
            rehydrateHand(resolvedSessionId);
          }
        } else if (event.type === "CARDS_PER_PLAYER_CHANGED") {
            setCardsPerPlayer(event.payload.cardsPerPlayer);
        } else if (event.type === "DECK_COUNT_CHANGED") {
          setDeckCount(event.payload.deckCount);
        } else if (event.type === "DISCARD_MODE_CHANGED") {
          setDiscardMode(event.payload.discardMode);
        } else if (event.type === "CARD_DISCARDED") {
          setTopDiscard(event.payload.topDiscard);
        } else if (event.type === "GAME_MODE_CHANGED") {
          setGameMode(event.payload.gameMode);
        } else if (event.type === "CARD_DRAWN") {
          setRemaining(event.payload.remaining);
          if (event.payload.topDiscard !== undefined) {
            setTopDiscard(event.payload.topDiscard ?? null);
          }
          if (event.payload.reshuffled) {
            setStatusMessage("Discard pile reshuffled into Draw pile");
          }
        } else if (event.type === "TURN_CHANGED") {
          setCurrentTurn(event.payload.playerId);
        } else {
          setMessages((prev) => [...prev, message.body]);
        }
      }
    );

    stompClient.publish({
      destination: `/app/session/${resolvedSessionId}/join`,
      body: JSON.stringify({ playerId, displayName }),
    });
  };

  const createAndJoin = async () => {
    if (!client || !playerId) return;
    const createRes = await fetch("http://localhost:8080/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameMode, discardMode, deckCount, cardsPerPlayer }),
    });

    const {
      code: newCode,
      gameMode: createdMode,
      discardMode: createdDiscard,
      deckCount: createdDecks,
      cardsPerPlayer: createdCards,
    } = await createRes.json();
    setGameMode(createdMode);
    setDiscardMode(createdDiscard);
    if (createdDecks != null) setDeckCount(createdDecks);
    if (createdCards != null) setCardsPerPlayer(createdCards);
    setCode(newCode);

    const resolveRes = await fetch(
      `http://localhost:8080/api/sessions/${newCode}`
    );
    const { sessionId: resolvedId } = await resolveRes.json();
    setSessionId(resolvedId);
    sessionStorage.setItem("digitalDeck.sessionId", resolvedId);
    sessionStorage.setItem("digitalDeck.displayName", displayName);

    subscribeAndJoin(resolvedId, client);
  };

  const joinExisting = async () => {
    if (!client || !joinCodeInput || !playerId) return;

    const resolveRes = await fetch(
      `http://localhost:8080/api/sessions/${joinCodeInput}`
    );
    if (!resolveRes.ok) {
      alert("Session not found");
      return;
    }
    const { sessionId: resolvedId } = await resolveRes.json();
    setSessionId(resolvedId);

    sessionStorage.setItem("digitalDeck.sessionId", resolvedId);
    sessionStorage.setItem("digitalDeck.displayName", displayName);

    subscribeAndJoin(resolvedId, client);
  };

  const startGame = async () => {
    if (!sessionId) return;
    const res = await fetch(
      `http://localhost:8080/api/sessions/${sessionId}/deck/init?playerId=${playerId}`,
      { method: "POST" }
    );
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Could not start game");
    }
  };

  const updateGameMode = async (next: "TURN_ROTATION" | "FREE_ROTATION") => {
    if (!sessionId) return;
    const res = await fetch(
      `http://localhost:8080/api/sessions/${sessionId}/game-mode`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameMode: next, playerId }),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Could not update mode");
      return;
    }
  
    setGameMode(next);
  
    const nextDiscard = coerceDiscardMode(next, discardMode);
    if (nextDiscard !== discardMode) {
      await updateDiscardMode(nextDiscard);
    }
  };

  const drawCard = async () => {
    if (!sessionId) return;

    const res = await fetch(`http://localhost:8080/api/sessions/${sessionId}/draw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });

    if (!res.ok) {
      const error = await res.json();
      alert(error.error ?? "Could not draw");
      return;
    }

    const { card } = await res.json();
    setHand((prev) => [...prev, card]);
  };

  const rehydrateHand = async (resolvedSessionId: string) => {
    const res = await fetch(`http://localhost:8080/api/sessions/${resolvedSessionId}/hand?playerId=${playerId}`);
    if (!res.ok) return;
    const { hand: savedHand } = await res.json();
    setHand(savedHand);
  };

  const leaveSession = () => {
    if (!client || !sessionId) return;

    client.publish({
      destination: `/app/session/${sessionId}/leave`,
      body: JSON.stringify({ playerId }),
    });

    sessionSubscriptionRef.current?.unsubscribe();
    sessionSubscriptionRef.current = null;

    setSessionId(null);
    setRoster({});
    setMessages([]);
    setGameStarted(false);
    setCurrentTurn(null);
    setHostId(null);
    setHand([]);
    setRemaining(null);
    setDiscardMode("DISCARD_OFF");
    setTopDiscard(null);
    setStatusMessage(null);

    sessionStorage.removeItem("digitalDeck.sessionId");
    sessionStorage.removeItem("digitalDeck.displayName");
  };

  const discardCard = async (card: string) => {
    if (!sessionId) return;
  
    const res = await fetch(`http://localhost:8080/api/sessions/${sessionId}/discard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, card }),
    });
  
    if (!res.ok) {
      const error = await res.json();
      alert(error.error ?? "Could not discard");
      return;
    }
  
    setHand((prev) => {
      const idx = prev.indexOf(card);
      if (idx === -1) return prev;
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });
  };
  const updateDiscardMode = async (next: DiscardMode) => {
    if (!sessionId) return;
    const res = await fetch(
      `http://localhost:8080/api/sessions/${sessionId}/discard-mode`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discardMode: next, playerId }),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Could not update discard mode");
      return;
    }
    setDiscardMode(next);
  };

  const updateDeckCount = async (next: number) => {
    if (!sessionId) return;
    const res = await fetch(
      `http://localhost:8080/api/sessions/${sessionId}/deck-count`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckCount: next, playerId }),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Could not update deck count");
      return;
    }
    setDeckCount(next);
  };

  const updateCardsPerPlayer = async (next: number) => {
    if (!sessionId) return;
    const clamped = Math.max(0, Math.min(52, next));
    const res = await fetch(
      `http://localhost:8080/api/sessions/${sessionId}/cards-per-player`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardsPerPlayer: clamped, playerId }),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Could not update cards per player");
      return;
    }
    setCardsPerPlayer(clamped);
  };

  if (!sessionId) {
    return (
      <HomeScreen
        displayName={displayName}
        joinCodeInput={joinCodeInput}
        gameMode={gameMode}
        clientReady={!!client}
        discardMode={discardMode}
        onDisplayNameChange={setDisplayName}
        onJoinCodeChange={setJoinCodeInput}
        onGameModeChange={handleGameModeChange}
        onCreate={createAndJoin}
        onJoin={joinExisting}
        onDiscardModeChange={setDiscardMode}
      />
    );
  }
  
  if (!gameStarted) {
    return (
      <LobbyScreen
        code={code}
        roster={roster}
        playerId={playerId}
        hostId={hostId}
        gameMode={gameMode}
        discardMode={discardMode}
        onUpdateGameMode={updateGameMode}
        onStart={startGame}
        onLeave={leaveSession}
        onUpdateDiscardMode={updateDiscardMode}
        deckCount={deckCount}
        cardsPerPlayer={cardsPerPlayer}
        onUpdateDeckCount={updateDeckCount}
        onUpdateCardsPerPlayer={updateCardsPerPlayer}
      />
    );
  }
  
  return (
    <SessionScreen
      roster={roster}
      playerId={playerId}
      gameMode={gameMode}
      currentTurn={currentTurn}
      hand={hand}
      remaining={remaining}
      onDraw={drawCard}
      onLeave={leaveSession}
      discardMode={discardMode}
      topDiscard={topDiscard}
      onDiscard={discardCard}
      statusMessage={statusMessage}
    />
  );

}
