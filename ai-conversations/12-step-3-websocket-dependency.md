## me
yes I want to start with adding the WebSocket dependency and a minimal config class

---
## Claude
Let's add the WebSocket dependency and get a minimal config in place.

**Add to `backend/pom.xml`**, inside `<dependencies>`:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

This pulls in Spring's WebSocket + STOMP support — STOMP is the messaging protocol layered on top of raw WebSocket that gives you the "topics" and "destinations" concept (like `/topic/session/{id}`) instead of just a bare byte stream. It's what makes pub/sub-style messaging manageable rather than hand-rolling your own message format.

**Config class** — put this in a new `config/` folder, alongside `controller/` and `service/`:

```java
package com.ava.digitaldeck.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOrigins("http://localhost:3000");
    }
}
```

Breaking down what each piece actually does:

- **`@EnableWebSocketMessageBroker`** turns on the whole STOMP-over-WebSocket machinery — without this annotation, adding the dependency alone does nothing.
- **`enableSimpleBroker("/topic")`** — this is the important one to understand. It tells Spring "handle pub/sub in-memory, yourself" for any destination starting with `/topic`. This is what makes the earlier design (`/topic/session/{sessionId}`) actually work. The word "simple" is doing real work in that method name: this broker lives entirely inside your one Java process. It's perfect for local dev and even for your single-EC2-instance deployment — but if you ever ran multiple backend instances behind a load balancer, a message published on instance A wouldn't reach a client connected to instance B. The fix at that point would be swapping this for a real message broker (Redis pub/sub, actually, tying back to what you already have — or RabbitMQ), but that's a "someday" problem, not today's.
- **`setApplicationDestinationPrefixes("/app")`** — this is the other half of the earlier design: client-to-server messages (`/app/session/{sessionId}/draw`) get routed to your `@MessageMapping` handlers, while `/topic` is reserved for server-to-client broadcasts. Two prefixes, two directions, no collision.
- **`addEndpoint("/ws")`** is the actual URL the frontend connects to first to establish the WebSocket connection — everything after that (subscribing to topics, sending to `/app` destinations) happens over that one connection.
- **`setAllowedOrigins`** is the WebSocket equivalent of `@CrossOrigin` from your REST controllers — same underlying problem (browser blocking cross-origin requests), same fix, just configured differently because WebSocket isn't a normal HTTP request/response cycle.

Restart the backend and confirm it still starts cleanly with no errors — that's the whole test for this step, since there's no endpoint to hit yet with just a config class. The real proof comes next: adding a `@MessageMapping` handler and a frontend that subscribes to a topic, so you can watch an actual message travel from one browser tab to another through this pipe.

Want to build that test round-trip next?

---
## me
yes

---
## Claude
Let's build a minimal end-to-end test: a message sent from one browser tab, broadcast through the server, received by whoever's subscribed.

**Backend — a `@MessageMapping` handler**

Add this to a new controller in your `controller/` folder:

```java
package com.ava.digitaldeck.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.util.Map;

@Controller
public class WebSocketTestController {

    @MessageMapping("/test")
    public Map<String, String> handleTest(Map<String, String> payload) {
        return Map.of("echo", payload.get("message"), "receivedAt", java.time.Instant.now().toString());
    }
}
```

Notice this is `@Controller`, not `@RestController` — that distinction matters here. `@RestController` is for normal HTTP endpoints; `@MessageMapping` handlers are STOMP message handlers, a different routing mechanism entirely, so it needs the plain `@Controller` annotation instead.

There's also a config addition needed — right now, returning a value from a `@MessageMapping` method doesn't automatically go anywhere unless you tell Spring where. Add `@SendTo`:

```java
@MessageMapping("/test")
@SendTo("/topic/test")
public Map<String, String> handleTest(Map<String, String> payload) {
    return Map.of("echo", payload.get("message"), "receivedAt", java.time.Instant.now().toString());
}
```

Now the flow is: client sends to `/app/test` → this method runs → whatever it returns gets broadcast to everyone subscribed to `/topic/test`.

**Frontend — connect, subscribe, send**

You'll need a STOMP client library:

```bash
npm install @stomp/stompjs
```

Replace your `app/page.tsx` content with a test harness:

```tsx
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
```

A few things worth understanding:

- **`brokerURL: "ws://localhost:8080/ws"`** — `ws://` not `http://`, since this is a different protocol. That `/ws` path matches the endpoint you registered in `WebSocketConfig` earlier.
- **`onConnect`** is where you subscribe — you can't subscribe to a topic before the connection is actually established, so STOMP clients structure this as a callback rather than something you do immediately after creating the client.
- **The cleanup function** (`return () => stompClient.deactivate()`) matters more here than in your earlier `ping` fetch — that was a one-shot request that finished instantly. A WebSocket connection stays open, so if this component unmounts without deactivating it, you'd leak an open connection. React's `useEffect` cleanup pattern exists exactly for this kind of teardown.
- **Two tabs, one broadcast**: open `localhost:3000` in two separate browser tabs. Click "Send test message" in tab A — you should see the echoed message appear in *both* tabs, not just the one that sent it. That's the actual proof pub/sub is working — if only the sending tab saw it, you'd just have request/response with extra steps.

Restart the backend, run the frontend, and try it across two tabs. If a message shows up in both, you've got the real-time layer proven — and everything from here (drawing a card, announcing a new player) is the same pattern with real payloads instead of a test string.

---
## me
the message shows up in both

---
## Claude
That's the full real-time loop proven — pub/sub, actual round trip across two independent browser sessions, exactly the mechanism your whole multiplayer design depends on. This is a bigger milestone than the earlier checkpoints: everything the deck itself needs (broadcasting a draw, a turn change, a new player joining) is the same pattern you just built, just with real payloads instead of a test string.

Good spot for a commit before moving on.

You're now at the point where the three foundational pieces are all independently proven: Postgres, Redis, and WebSocket, each wired correctly to Spring Boot and reachable from the frontend. Real deck logic is next — this is where the earlier Redis key design (`session:{id}:deck` as a list, `LPOP` to deal, etc.) stops being a diagram and starts being actual code.

Want to build the real session creation flow next — replacing the test WebSocket handler with an actual "player joins a session" message that broadcasts to everyone on `/topic/session/{sessionId}`, using the session/code logic you already built?