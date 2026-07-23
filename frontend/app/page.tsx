"use client";

import { useEffect, useState } from "react";
import { Client } from "@stomp/stompjs";

export default function Home() {
  const [messages, setMessages] = useState<string[]>([]);
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    const stompClient = new Client({
      brokerURL: "ws://localhost:8080/ws",
      onConnect: () => {
        stompClient.subscribe("/topic/test", (message) => {
          setMessages((prev) => [...prev, message.body]);
        });
      },
    });

    stompClient.activate();
    setClient(stompClient);

    return () => {
      stompClient.deactivate();
    };
  }, []);

  const sendTestMessage = () => {
    client?.publish({
      destination: "/app/test",
      body: JSON.stringify({ message: "hello from the browser" }),
    });
  };

  return (
    <main>
      <button onClick={sendTestMessage}>Send test message</button>
      <ul>
        {messages.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    </main>
  );
}