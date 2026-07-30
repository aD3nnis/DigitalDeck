package com.ava.digitaldeck.services;

import com.ava.digitaldeck.model.GameMode;
import com.ava.digitaldeck.model.SessionEvent;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.HashMap;
import java.util.Optional;

@Service
public class GameStartService {

    public sealed interface StartResult {
        record Ok(Object body) implements StartResult {}
        record NotFound() implements StartResult {}
        record Forbidden(String error) implements StartResult {}
        record Conflict(String error) implements StartResult {}
        record BadRequest(Object body) implements StartResult {}
    }

    private final SessionService sessionService;
    private final DeckService deckService;
    private final TurnService turnService;
    private final LobbySettingsService lobbySettingsService;
    private final SimpMessagingTemplate messagingTemplate;

    public GameStartService(SessionService sessionService,
                            DeckService deckService,
                            TurnService turnService,
                            LobbySettingsService lobbySettingsService,
                            SimpMessagingTemplate messagingTemplate) {
        this.sessionService = sessionService;
        this.deckService = deckService;
        this.turnService = turnService;
        this.lobbySettingsService = lobbySettingsService;
        this.messagingTemplate = messagingTemplate;
    }

    public StartResult startGame(String sessionId, String playerId) {
        Optional<LobbySettingsService.UpdateResult> denied =
                lobbySettingsService.denyUnlessHostInLobby(sessionId, playerId);
        if (denied.isPresent()) {
            return switch (denied.get()) {
                case LobbySettingsService.UpdateResult.NotFound() -> new StartResult.NotFound();
                case LobbySettingsService.UpdateResult.Forbidden(String e) -> new StartResult.Forbidden(e);
                case LobbySettingsService.UpdateResult.Conflict(String e) -> new StartResult.Conflict(e);
                case LobbySettingsService.UpdateResult.Ok ignored ->
                        throw new IllegalStateException("deny helper should not return Ok");
            };
        }

        // Friendlier host message for start-game (optional)
        // You can pass a custom forbidden string from denyUnlessHostInLobby instead.

        if (!sessionService.canDealStartingHands(sessionId)) {
            int players = sessionService.getPlayerOrder(sessionId).size();
            int cardsPerPlayer = sessionService.getCardsPerPlayer(sessionId);
            int deckCount = sessionService.getDeckCount(sessionId);
            return new StartResult.BadRequest(Map.of(
                    "error", "not enough cards for starting hands",
                    "players", players,
                    "cardsPerPlayer", cardsPerPlayer,
                    "needed", players * cardsPerPlayer,
                    "available", deckCount * 52
            ));
        }

        int deckCount = sessionService.getDeckCount(sessionId);
        int cardsPerPlayer = sessionService.getCardsPerPlayer(sessionId);
        deckService.initializeDeck(sessionId, deckCount);
        deckService.dealStartingHands(
                sessionId,
                sessionService.getPlayerOrder(sessionId),
                cardsPerPlayer
        );

        GameMode mode = sessionService.getGameMode(sessionId);
        long remaining = deckService.remainingCount(sessionId);

        messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                new SessionEvent("DECK_INITIALIZED", sessionId, Map.of(
                        "remaining", remaining,
                        "gameMode", mode.name(),
                        "cardsPerPlayer", cardsPerPlayer
                )));

        String currentPlayer = null;
        if (mode == GameMode.TURN_ROTATION) {
            turnService.startTurns(sessionId);
            currentPlayer = turnService.getCurrentPlayer(sessionId).orElse(null);
            messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                    new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", currentPlayer)));
        }

        Map<String, Object> body = new HashMap<>();
        body.put("remaining", remaining);
        body.put("currentTurn", currentPlayer); // may be null
        body.put("gameMode", mode.name());
        body.put("cardsPerPlayer", cardsPerPlayer);
        return new StartResult.Ok(body);

    }
    
}