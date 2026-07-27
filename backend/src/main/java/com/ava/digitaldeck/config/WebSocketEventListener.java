package com.ava.digitaldeck.config;

import com.ava.digitaldeck.model.SessionEvent;
import com.ava.digitaldeck.services.ConnectionRegistry;
import com.ava.digitaldeck.services.SessionService;
import com.ava.digitaldeck.services.TurnService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;


import java.util.Map;
import java.util.HashMap;

@Component
public class WebSocketEventListener {

    private final ConnectionRegistry connectionRegistry;
    private final SessionService sessionService;
    private final SimpMessagingTemplate messagingTemplate;
    private final TurnService turnService;

    @Autowired
    public WebSocketEventListener(ConnectionRegistry connectionRegistry, SessionService sessionService,
                                    SimpMessagingTemplate messagingTemplate, TurnService turnService) {
        this.connectionRegistry = connectionRegistry;
        this.sessionService = sessionService;
        this.messagingTemplate = messagingTemplate;
        this.turnService = turnService;
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        SimpMessageHeaderAccessor headerAccessor = SimpMessageHeaderAccessor.wrap(event.getMessage());
        String webSocketSessionId = headerAccessor.getSessionId();

        ConnectionRegistry.PlayerConnection connection = connectionRegistry.remove(webSocketSessionId);
        if (connection == null) {
            return; // never joined a game session, nothing to clean up
        }

        String nextPlayer = turnService.handlePlayerLeft(connection.sessionId(), connection.playerId()).orElse(null);
        
        sessionService.removePlayer(connection.sessionId(), connection.playerId());

        SessionEvent leaveEvent = new SessionEvent(
                "PLAYER_LEFT",
                connection.sessionId(),
                Map.of("playerId", connection.playerId())
        );
        messagingTemplate.convertAndSend("/topic/session/" + connection.sessionId(), leaveEvent);

        SessionEvent rosterEvent = new SessionEvent(
                "ROSTER",
                connection.sessionId(),
                sessionService.getPlayers(connection.sessionId())
        );
        messagingTemplate.convertAndSend("/topic/session/" + connection.sessionId(), rosterEvent);

        Map<String, String> turnPayload = new HashMap<>();
        turnPayload.put("playerId", nextPlayer);
        messagingTemplate.convertAndSend("/topic/session/" + connection.sessionId(),
                new SessionEvent("TURN_CHANGED", connection.sessionId(), turnPayload));

        Map<String, String> hostPayload = new HashMap<>();
        hostPayload.put("playerId", sessionService.getHost(connection.sessionId()).orElse(null));
        messagingTemplate.convertAndSend("/topic/session/" + connection.sessionId(),
                new SessionEvent("HOST_CHANGED", connection.sessionId(), hostPayload));
    }
}