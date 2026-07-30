package com.ava.digitaldeck.services;

import com.ava.digitaldeck.model.SessionEvent;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
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

        if (!sessionService.sessionExists(sessionId)) {
            return new UpdateResult.NotFound();
        }

        var host = sessionService.getHost(sessionId);
        if (host.isEmpty() || !host.get().equals(playerId)) {
            return new UpdateResult.Forbidden("only the host can change this setting");
        }

        if (sessionService.gameStarted(sessionId)) {
            return new UpdateResult.Conflict("game already started");
        }

        applyChange.run();

        messagingTemplate.convertAndSend(
                "/topic/session/" + sessionId,
                new SessionEvent(eventType, sessionId, eventPayload.get()));

        return new UpdateResult.Ok(responseBody.get());
    }
}