package com.ava.digitaldeck.controllers;

import com.ava.digitaldeck.model.JoinRequest;
import com.ava.digitaldeck.model.SessionEvent;
import com.ava.digitaldeck.services.SessionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.Map;

@Controller
public class SessionSocketController {

    private final SessionService sessionService;
    private final SimpMessagingTemplate messagingTemplate;

    @Autowired
    public SessionSocketController(SessionService sessionService, SimpMessagingTemplate messagingTemplate) {
        this.sessionService = sessionService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/session/{sessionId}/join")
    public void join(@DestinationVariable String sessionId, JoinRequest request) {
        if (!sessionService.sessionExists(sessionId)) {
            return;
        }
    
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
}