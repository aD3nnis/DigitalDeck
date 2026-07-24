package com.ava.digitaldeck.services;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ConnectionRegistry {

    public record PlayerConnection(String sessionId, String playerId) {}

    private final Map<String, PlayerConnection> connections = new ConcurrentHashMap<>();

    public void register(String webSocketSessionId, String sessionId, String playerId) {
        connections.put(webSocketSessionId, new PlayerConnection(sessionId, playerId));
    }

    public PlayerConnection remove(String webSocketSessionId) {
        return connections.remove(webSocketSessionId);
    }
}