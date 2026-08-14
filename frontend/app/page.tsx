"use client";

import { useEffect, useRef, useState } from "react";
import { Client, StompSubscription } from "@stomp/stompjs";
import HomeScreen from "../components/HomeScreen";
import LobbyScreen from "../components/LobbyScreen";
import SessionScreen from "../components/SessionScreen";
import type { DiscardMode, GameMode, PlayMode } from "../components/types";
import { coerceDiscardMode, coercePlayMode } from "../components/types";
import { SlotId } from "@/components/Plyr1PlayBoard";
import type { PlayArea } from "../components/types";


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
  const [playMode, setPlayMode] = useState<PlayMode>("PLAY_OFF");
  const [playAreas, setPlayAreas] = useState<Record<string, PlayArea>>({});
  const handleGameModeChange = (next: GameMode) => {
    setGameMode(next);
    setDiscardMode((prev) => coerceDiscardMode(next, prev));
    setPlayMode((prev) => coercePlayMode(next, prev));
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
          if (event.payload.playMode) setPlayMode(event.payload.playMode);
          if (event.payload.playAreas) setPlayAreas(event.payload.playAreas);
        } else if (event.type === "CARDS_PER_PLAYER_CHANGED") {
            setCardsPerPlayer(event.payload.cardsPerPlayer);
        } else if (event.type === "DECK_COUNT_CHANGED") {
          setDeckCount(event.payload.deckCount);
        } else if (event.type === "DISCARD_MODE_CHANGED") {
          setDiscardMode(event.payload.discardMode);
        } else if (event.type === "PLAY_MODE_CHANGED") {
          setPlayMode(event.payload.playMode);
        } else if (event.type === "CARDS_PLAYED") {
          setPlayAreas((prev) => ({
            ...prev,
            [event.payload.playerId]: event.payload.playArea,
          }));
        } else if (event.type === "CARD_DISCARDED") {
          setTopDiscard(event.payload.topDiscard);
          if (event.payload.source === "PLAY" && event.payload.playArea) {
            setPlayAreas((prev) => ({
              ...prev,
              [event.payload.playerId]: event.payload.playArea,
            }));
          }
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
      body: JSON.stringify({ gameMode, discardMode, playMode, deckCount, cardsPerPlayer }),
    });

    const {
      code: newCode,
      gameMode: createdMode,
      discardMode: createdDiscard,
      deckCount: createdDecks,
      cardsPerPlayer: createdCards,
      playMode: createdPlay,
    } = await createRes.json();
    setGameMode(createdMode);
    setDiscardMode(createdDiscard);
    if (createdPlay) setPlayMode(createdPlay);
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
    
    const nextPlay = coercePlayMode(next, playMode);
    if (nextPlay !== playMode) {
      await updatePlayMode(nextPlay);
    }
  };

  const drawCard = async (): Promise<string | null> => {
    if (!sessionId) return null;

    const res = await fetch(`http://localhost:8080/api/sessions/${sessionId}/draw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });

    if (!res.ok) {
      const error = await res.json();
      alert(error.error ?? "Could not draw");
      return null;
    }

    const { card } = await res.json();
    setHand((prev) => [...prev, card]);
    return card as string;  // ← this is the important addition
  };

  const keepCard = async (): Promise<boolean> => {
    if (!sessionId) return false;
    const res = await fetch(
      `http://localhost:8080/api/sessions/${sessionId}/keep`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      }
    );
    if (!res.ok) {
      const error = await res.json();
      alert(error.error ?? "Could not keep");
      return false;
    }
    return true;
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
    setPlayMode("PLAY_OFF");
    setPlayAreas({});

    sessionStorage.removeItem("digitalDeck.sessionId");
    sessionStorage.removeItem("digitalDeck.displayName");
  };

  const discardCards = async (
    cards: string[],
    source: "HAND" | "PLAY" = "HAND"
  ): Promise<boolean> => {
    if (!sessionId || cards.length === 0) return false;
  
    const res = await fetch(`http://localhost:8080/api/sessions/${sessionId}/discard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, cards, source }),
    });
  
    if (!res.ok) {
      const error = await res.json();
      alert(error.error ?? "Could not discard");
      return false;
    }
  
    const body = await res.json();
    const discarded = body.cards;
    
    if (source === "HAND") {
      setHand((prev) => {
        let next = [...prev];
        for (const card of discarded as string[]) {
          const idx = next.indexOf(card);
          if (idx !== -1) next = [...next.slice(0, idx), ...next.slice(idx + 1)];
        }
        return next;
      });
    } else if (body.playArea) {
      setPlayAreas((prev) => ({ ...prev, [playerId]: body.playArea }));
    }
    return true;
  };
  
  const playCards = async (cards: string[], startSlot: SlotId): Promise<boolean> => {
    if (!sessionId || cards.length === 0) return false;
    const res = await fetch(`http://localhost:8080/api/sessions/${sessionId}/play`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, cards, startSlot }),
    });
    if (!res.ok) {
      const error = await res.json();
      alert(error.error ?? "Could not play");
      return false;
    }
    const { playArea } = await res.json();
    setHand((prev) => {
      let next = [...prev];
      for (const card of cards) {
        const idx = next.indexOf(card);
        if (idx !== -1) next = [...next.slice(0, idx), ...next.slice(idx + 1)];
      }
      return next;
    });
    setPlayAreas((prev) => ({ ...prev, [playerId]: playArea }));
    return true;
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

  const updatePlayMode = async (next: PlayMode) => {
    if (!sessionId) return;
    const res = await fetch(
      `http://localhost:8080/api/sessions/${sessionId}/play-mode`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playMode: next, playerId }),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Could not update play mode");
      return;
    }
    setPlayMode(next);
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
        playMode={playMode}
        onPlayModeChange={setPlayMode}
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
        playMode={playMode}
        onUpdateGameMode={updateGameMode}
        onUpdatePlayMode={updatePlayMode}
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
      playMode={playMode}
      playAreas={playAreas}
      topDiscard={topDiscard}
      onDiscard={discardCards}
      onPlay={playCards}
      statusMessage={statusMessage}
      onKeep={keepCard}
    />
  );

}
