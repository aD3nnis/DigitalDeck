"use client";

import { useEffect, useRef, useState } from "react";
import { Client, StompSubscription } from "@stomp/stompjs";


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
        } else if (event.type === "GAME_STATE") {
          setGameStarted(event.payload.gameStarted);
          setRemaining(event.payload.remaining);
          setCurrentTurn(event.payload.currentTurn);
        } else if (event.type === "CARD_DRAWN") {
          setRemaining(event.payload.remaining);
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
    });
    const { code: newCode } = await createRes.json();
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

    await fetch(`http://localhost:8080/api/sessions/${sessionId}/deck/init?playerId=${playerId}`, {
      method: "POST",
    });
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

    sessionStorage.removeItem("digitalDeck.sessionId");
    sessionStorage.removeItem("digitalDeck.displayName");
  };

  return (
    <main>
      <section>
        <button onClick={createAndJoin} disabled={!client}>
          Create &amp; join session
        </button>
        {code && <p>Session code: {code}</p>}
      </section>

      <section>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
        />
        <input
          value={joinCodeInput}
          onChange={(e) => setJoinCodeInput(e.target.value)}
          placeholder="Enter code"
        />
        <button onClick={joinExisting} disabled={!client}>
          Join session
        </button>
      </section>
      {sessionId && (
        <>
          {gameStarted && <h2>Players in session</h2>}
          <ul>
            {Object.entries(roster).map(([id, name]) => (
              <li key={id}>
                {name} <small>({id})</small>
              </li>
            ))}
          </ul>
        </>
      )}
      {sessionId && playerId === hostId && !gameStarted && (
        <button onClick={startGame}>Start game</button>
      )}
      <br />
      {gameStarted && <p>
        Current turn: {currentTurn ? roster[currentTurn] ?? currentTurn : "—"}
        {currentTurn === playerId && " (this is you!)"}
      </p>}
      {gameStarted && <p>Cards remaining: {remaining}</p>}
      {sessionId && gameStarted && currentTurn === playerId && (
        <button onClick={drawCard}>Draw card</button>
      )}
      {gameStarted && <h2>Your hand</h2>}
      {gameStarted && <ul>
        {hand.map((card, i) => (
          <li key={i}>{card}</li>
        ))}
      </ul>}
      {sessionId && (
        <button onClick={leaveSession}>Leave session</button>
      )}
    </main>
  );
}
