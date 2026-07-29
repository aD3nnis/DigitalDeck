package com.ava.digitaldeck.controllers;

import com.ava.digitaldeck.model.JoinRequest;
import com.ava.digitaldeck.model.LeaveRequest;  
import com.ava.digitaldeck.model.SessionEvent;
import com.ava.digitaldeck.model.GameMode;
import com.ava.digitaldeck.model.DiscardMode;
import com.ava.digitaldeck.services.SessionService;
import com.ava.digitaldeck.services.TurnService;
import com.ava.digitaldeck.services.DeckService;
import com.ava.digitaldeck.services.DisconnectGraceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import com.ava.digitaldeck.services.ConnectionRegistry;

import java.util.Map;
import java.util.HashMap;

@Controller
public class SessionSocketController {

    private final SessionService sessionService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ConnectionRegistry connectionRegistry;
    private final TurnService turnService;
    private final DeckService deckService;
    private final DisconnectGraceService disconnectGraceService;
    @Autowired
    public SessionSocketController(SessionService sessionService,
                                   SimpMessagingTemplate messagingTemplate,
                                   ConnectionRegistry connectionRegistry,
                                   TurnService turnService,
                                   DeckService deckService,
                                   DisconnectGraceService disconnectGraceService) {
        this.sessionService = sessionService;
        this.messagingTemplate = messagingTemplate;
        this.connectionRegistry = connectionRegistry;
        this.turnService = turnService;
        this.deckService = deckService;
        this.disconnectGraceService = disconnectGraceService;
    }

    @MessageMapping("/session/{sessionId}/join")
    public void join(@DestinationVariable String sessionId, JoinRequest request,
        SimpMessageHeaderAccessor headerAccessor) {
            if (!sessionService.sessionExists(sessionId)) {
                return;
            }
        
        String webSocketSessionId = headerAccessor.getSessionId();
        connectionRegistry.register(webSocketSessionId, sessionId, request.playerId());

        boolean wasPending = disconnectGraceService.cancel(sessionId, request.playerId());
        sessionService.addPlayer(sessionId, request.playerId(), request.displayName());
    
        if (!wasPending) {
            SessionEvent joinEvent = new SessionEvent(
                    "PLAYER_JOINED",
                    sessionId,
                    Map.of("playerId", request.playerId(), "displayName", request.displayName())
            );
            messagingTemplate.convertAndSend("/topic/session/" + sessionId, joinEvent);
        }
        SessionEvent rosterEvent = new SessionEvent(
                "ROSTER",
                sessionId,
                sessionService.getPlayers(sessionId)
        );
        messagingTemplate.convertAndSend("/topic/session/" + sessionId, rosterEvent);

        Map<String, String> hostPayload = new HashMap<>();
        hostPayload.put("playerId", sessionService.getHost(sessionId).orElse(null));
        messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                new SessionEvent("HOST_CHANGED", sessionId, hostPayload));

        boolean started = sessionService.gameStarted(sessionId);
        GameMode mode = sessionService.getGameMode(sessionId);
        DiscardMode discardMode = sessionService.getDiscardMode(sessionId);
        
        Map<String, Object> gameState = new HashMap<>();
        gameState.put("gameStarted", started);
        gameState.put("gameMode", mode.name());
        gameState.put("discardMode", discardMode.name());
        gameState.put("deckCount", sessionService.getDeckCount(sessionId));
        gameState.put("cardsPerPlayer", sessionService.getCardsPerPlayer(sessionId));
        gameState.put("remaining", started ? deckService.remainingCount(sessionId) : null);
        gameState.put("topDiscard",
                started ? deckService.getTopDiscard(sessionId).orElse(null) : null);
        gameState.put("currentTurn",
                started && mode == GameMode.TURN_ROTATION
                        ? turnService.getCurrentPlayer(sessionId).orElse(null)
                        : null);
        
        messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                new SessionEvent("GAME_STATE", sessionId, gameState));
    }

    @MessageMapping("/session/{sessionId}/leave")
    public void leave(@DestinationVariable String sessionId, LeaveRequest request) {
        if (!sessionService.sessionExists(sessionId)) return;
    
        disconnectGraceService.leaveNow(sessionId, request.playerId());
    }
}