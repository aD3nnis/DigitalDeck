"use client";

import { useEffect, useState } from "react";
import { Client } from "@stomp/stompjs";

export default function Home() {
  const [messages, setMessages] = useState<string[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");

  useEffect(() => {
    const stompClient = new Client({
      brokerURL: "ws://localhost:8080/ws",
      onConnect: () => {
        setClient(stompClient);
      },
    });

    stompClient.activate();

    return () => {
      stompClient.deactivate();
    };
  }, []);

  const [playerId] = useState(() => crypto.randomUUID()); // once per tab, not per click
  
  const subscribeAndJoin = (resolvedSessionId: string, stompClient: Client) => {
    if (sessionId === resolvedSessionId) return; // already in this session, don't resubscribe
  
    stompClient.subscribe(`/topic/session/${resolvedSessionId}`, (message) => {
      setMessages((prev) => [...prev, message.body]);
    });
  
    stompClient.publish({
      destination: `/app/session/${resolvedSessionId}/join`,
      body: JSON.stringify({ playerId, displayName: "Ava" }),
    });
  };

  const createAndJoin = async () => {
    if (!client) return;

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

    subscribeAndJoin(resolvedId, client);
  };

  const joinExisting = async () => {
    if (!client || !joinCodeInput) return;

    const resolveRes = await fetch(
      `http://localhost:8080/api/sessions/${joinCodeInput}`
    );
    if (!resolveRes.ok) {
      alert("Session not found");
      return;
    }
    const { sessionId: resolvedId } = await resolveRes.json();
    setSessionId(resolvedId);

    subscribeAndJoin(resolvedId, client);
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
          value={joinCodeInput}
          onChange={(e) => setJoinCodeInput(e.target.value)}
          placeholder="Enter code"
        />
        <button onClick={joinExisting} disabled={!client}>
          Join session
        </button>
      </section>

      <ul>
        {messages.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    </main>
  );
}