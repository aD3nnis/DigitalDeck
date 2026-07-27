package com.ava.digitaldeck.config;

import com.ava.digitaldeck.model.SessionEvent;
import com.ava.digitaldeck.services.ConnectionRegistry;
import com.ava.digitaldeck.services.SessionService;
import com.ava.digitaldeck.services.TurnService;
import com.ava.digitaldeck.services.DisconnectGraceService;
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
    private final DisconnectGraceService disconnectGraceService;
    @Autowired
    public WebSocketEventListener(ConnectionRegistry connectionRegistry, SessionService sessionService,
                                    SimpMessagingTemplate messagingTemplate, TurnService turnService,
                                    DisconnectGraceService disconnectGraceService) {
        this.connectionRegistry = connectionRegistry;
        this.sessionService = sessionService;
        this.messagingTemplate = messagingTemplate;
        this.turnService = turnService;
        this.disconnectGraceService = disconnectGraceService;
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        SimpMessageHeaderAccessor headerAccessor = SimpMessageHeaderAccessor.wrap(event.getMessage());
        String webSocketSessionId = headerAccessor.getSessionId();
    
        ConnectionRegistry.PlayerConnection connection = connectionRegistry.remove(webSocketSessionId);
        if (connection == null) {
            return;
        }
    
        disconnectGraceService.scheduleLeave(connection.sessionId(), connection.playerId());
    }
}