package com.ava.digitaldeck.config;

import com.ava.digitaldeck.model.SessionEvent;
import com.ava.digitaldeck.services.ConnectionRegistry;
import com.ava.digitaldeck.services.SessionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;


import java.util.Map;

@Component
public class WebSocketEventListener {

    private final ConnectionRegistry connectionRegistry;
    private final SessionService sessionService;
    private final SimpMessagingTemplate messagingTemplate;

    @Autowired
    public WebSocketEventListener(ConnectionRegistry connectionRegistry, SessionService sessionService,
                                    SimpMessagingTemplate messagingTemplate) {
        this.connectionRegistry = connectionRegistry;
        this.sessionService = sessionService;
        this.messagingTemplate = messagingTemplate;
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        SimpMessageHeaderAccessor headerAccessor = SimpMessageHeaderAccessor.wrap(event.getMessage());
        String webSocketSessionId = headerAccessor.getSessionId();

        ConnectionRegistry.PlayerConnection connection = connectionRegistry.remove(webSocketSessionId);
        if (connection == null) {
            return; // never joined a game session, nothing to clean up
        }

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
    }
}