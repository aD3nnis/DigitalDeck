"use client";

import { useEffect, useState } from "react";
import { Client } from "@stomp/stompjs";

export default function Home() {
  const [messages, setMessages] = useState<string[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

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

  const createAndJoin = async () => {
    if (!client) return;

    // 1. Create a session
    const createRes = await fetch("http://localhost:8080/api/sessions", {
      method: "POST",
    });
    const { code: newCode } = await createRes.json();
    setCode(newCode);

    // 2. Resolve the code to get the real sessionId
    const resolveRes = await fetch(
      `http://localhost:8080/api/sessions/${newCode}`
    );
    const { sessionId: resolvedId } = await resolveRes.json();
    setSessionId(resolvedId);

    // 3. Subscribe now that we know the sessionId
    client.subscribe(`/topic/session/${resolvedId}`, (message) => {
      setMessages((prev) => [...prev, message.body]);
    });

    // 4. Join
    const playerId = crypto.randomUUID();
    client.publish({
      destination: `/app/session/${resolvedId}/join`,
      body: JSON.stringify({ playerId, displayName: "Ava" }),
    });
  };

  return (
    <main>
      <button onClick={createAndJoin} disabled={!client}>
        Create &amp; join session
      </button>
      {code && <p>Session code: {code}</p>}
      <ul>
        {messages.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    </main>
  );
}