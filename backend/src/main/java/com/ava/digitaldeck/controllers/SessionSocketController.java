package com.ava.digitaldeck.controllers;

import com.ava.digitaldeck.model.JoinRequest;
import com.ava.digitaldeck.model.LeaveRequest;  
import com.ava.digitaldeck.model.SessionEvent;
import com.ava.digitaldeck.services.SessionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import com.ava.digitaldeck.services.ConnectionRegistry;

import java.util.Map;

@Controller
public class SessionSocketController {

    private final SessionService sessionService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ConnectionRegistry connectionRegistry;

    @Autowired
    public SessionSocketController(SessionService sessionService,
                                   SimpMessagingTemplate messagingTemplate,
                                   ConnectionRegistry connectionRegistry) {
        this.sessionService = sessionService;
        this.messagingTemplate = messagingTemplate;
        this.connectionRegistry = connectionRegistry;
    }

    @MessageMapping("/session/{sessionId}/join")
    public void join(@DestinationVariable String sessionId, JoinRequest request,
        SimpMessageHeaderAccessor headerAccessor) {
            if (!sessionService.sessionExists(sessionId)) {
                return;
            }
        
        String webSocketSessionId = headerAccessor.getSessionId();
        connectionRegistry.register(webSocketSessionId, sessionId, request.playerId());
        
        sessionService.addPlayer(sessionId, request.playerId(), request.displayName());
    
        SessionEvent joinEvent = new SessionEvent(
                "PLAYER_JOINED",
                sessionId,
                Map.of("playerId", request.playerId(), "displayName", request.displayName())
        );
        messagingTemplate.convertAndSend("/topic/session/" + sessionId, joinEvent);
    
        SessionEvent rosterEvent = new SessionEvent(
                "ROSTER",
                sessionId,
                sessionService.getPlayers(sessionId)
        );
        messagingTemplate.convertAndSend("/topic/session/" + sessionId, rosterEvent);
    }

    @MessageMapping("/session/{sessionId}/leave")
        public void leave(@DestinationVariable String sessionId, LeaveRequest request) {
            if (!sessionService.sessionExists(sessionId)) {
                return;
            }

            sessionService.removePlayer(sessionId, request.playerId());

            SessionEvent leaveEvent = new SessionEvent(
                    "PLAYER_LEFT",
                    sessionId,
                    Map.of("playerId", request.playerId())
            );
            messagingTemplate.convertAndSend("/topic/session/" + sessionId, leaveEvent);

            SessionEvent rosterEvent = new SessionEvent(
                    "ROSTER",
                    sessionId,
                    sessionService.getPlayers(sessionId)
            );
            messagingTemplate.convertAndSend("/topic/session/" + sessionId, rosterEvent);
        }
}