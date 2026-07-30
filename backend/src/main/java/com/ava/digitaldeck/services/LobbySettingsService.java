package com.ava.digitaldeck.services;

import com.ava.digitaldeck.model.SessionEvent;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

@Service
public class LobbySettingsService {

    public sealed interface UpdateResult {
        record Ok(Object body) implements UpdateResult {}
        record NotFound() implements UpdateResult {}
        record Forbidden(String error) implements UpdateResult {}
        record Conflict(String error) implements UpdateResult {}
    }

    private final SessionService sessionService;
    private final SimpMessagingTemplate messagingTemplate;

    public LobbySettingsService(SessionService sessionService,
                                 SimpMessagingTemplate messagingTemplate) {
        this.sessionService = sessionService;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Empty = allowed; present = stop and map to HTTP.
     * Host-only actions while still in lobby (game not started).
     */
    public Optional<UpdateResult> denyUnlessHostInLobby(String sessionId, String playerId) {
        if (!sessionService.sessionExists(sessionId)) {
            return Optional.of(new UpdateResult.NotFound());
        }
        var host = sessionService.getHost(sessionId);
        if (host.isEmpty() || !host.get().equals(playerId)) {
            return Optional.of(new UpdateResult.Forbidden("only the host can do this"));
        }
        if (sessionService.gameStarted(sessionId)) {
            return Optional.of(new UpdateResult.Conflict("game already started"));
        }
        return Optional.empty();
    }

    /**
     * Shared lobby policy: session exists, caller is host, game not started.
     * Caller supplies the actual mutation + broadcast payload.
     */
    public UpdateResult updateWhileInLobby(
            String sessionId,
            String playerId,
            Runnable applyChange,
            String eventType,
            Supplier<Map<String, ?>> eventPayload,
            Supplier<Object> responseBody) {

        Optional<UpdateResult> denied = denyUnlessHostInLobby(sessionId, playerId);
        if (denied.isPresent()) {
            return denied.get();
        }

        applyChange.run();

        messagingTemplate.convertAndSend(
                "/topic/session/" + sessionId,
                new SessionEvent(eventType, sessionId, eventPayload.get()));

        return new UpdateResult.Ok(responseBody.get());
    }
}