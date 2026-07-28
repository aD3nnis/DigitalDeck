package com.ava.digitaldeck.services;

import com.ava.digitaldeck.model.SessionEvent;
import com.ava.digitaldeck.model.GameMode;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@Service
public class DisconnectGraceService {

    private static final long GRACE_SECONDS = 10;

    private final SessionService sessionService;
    private final TurnService turnService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private final Map<String, ScheduledFuture<?>> pending = new ConcurrentHashMap<>();

    @Autowired
    public DisconnectGraceService(SessionService sessionService,
                                  TurnService turnService,
                                  SimpMessagingTemplate messagingTemplate) {
        this.sessionService = sessionService;
        this.turnService = turnService;
        this.messagingTemplate = messagingTemplate;
    }

    private static String key(String sessionId, String playerId) {
        return sessionId + ":" + playerId;
    }

    /** WS dropped — wait before treating as a real leave. */
    public void scheduleLeave(String sessionId, String playerId) {
        cancel(sessionId, playerId); // replace any existing timer
        ScheduledFuture<?> future = scheduler.schedule(
                () -> finalizeLeave(sessionId, playerId),
                GRACE_SECONDS,
                TimeUnit.SECONDS
        );
        pending.put(key(sessionId, playerId), future);
    }

    /** Refresh/rejoin within grace — stay in roster, keep turn. */
    public boolean cancel(String sessionId, String playerId) {
        ScheduledFuture<?> future = pending.remove(key(sessionId, playerId));
        if (future != null) {
            future.cancel(false);
            return true;
        }
        return false;
    }

    /** Explicit Leave button — cancel timer and remove now. */
    public void leaveNow(String sessionId, String playerId) {
        cancel(sessionId, playerId);
        finalizeLeave(sessionId, playerId);
    }

    private void finalizeLeave(String sessionId, String playerId) {
        pending.remove(key(sessionId, playerId));
        if (!sessionService.sessionExists(sessionId)) return;
    
        GameMode mode = sessionService.getGameMode(sessionId);
        String nextPlayer = null;
    
        if (mode == GameMode.TURN_ROTATION) {
            nextPlayer = turnService.handlePlayerLeft(sessionId, playerId).orElse(null);
        }
    
        sessionService.removePlayer(sessionId, playerId);
    
        messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                new SessionEvent("PLAYER_LEFT", sessionId, Map.of("playerId", playerId)));
    
        messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                new SessionEvent("ROSTER", sessionId, sessionService.getPlayers(sessionId)));
    
        if (mode == GameMode.TURN_ROTATION) {
            Map<String, String> turnPayload = new HashMap<>();
            turnPayload.put("playerId", nextPlayer);
            messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                    new SessionEvent("TURN_CHANGED", sessionId, turnPayload));
        }
    
        Map<String, String> hostPayload = new HashMap<>();
        hostPayload.put("playerId", sessionService.getHost(sessionId).orElse(null));
        messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                new SessionEvent("HOST_CHANGED", sessionId, hostPayload));
    }
}