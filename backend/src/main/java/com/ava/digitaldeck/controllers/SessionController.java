package com.ava.digitaldeck.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


import com.ava.digitaldeck.services.SessionService;
import com.ava.digitaldeck.services.DeckService;
import com.ava.digitaldeck.services.TurnService;
import com.ava.digitaldeck.services.LobbySettingsService;
import com.ava.digitaldeck.services.TurnActionPolicy;
import com.ava.digitaldeck.services.GameStartService;

import com.ava.digitaldeck.model.DrawRequest;
import com.ava.digitaldeck.model.SessionEvent;
import com.ava.digitaldeck.model.CreateSessionRequest;
import com.ava.digitaldeck.model.GameMode;
import com.ava.digitaldeck.model.UpdateGameModeRequest;
import com.ava.digitaldeck.model.DiscardMode;
import com.ava.digitaldeck.model.DiscardRequest;
import com.ava.digitaldeck.model.UpdateDiscardModeRequest;
import com.ava.digitaldeck.model.UpdateDeckCountRequest;
import com.ava.digitaldeck.model.UpdateCardsPerPlayerRequest;
import com.ava.digitaldeck.model.PlayMode;
import com.ava.digitaldeck.model.PlayRequest;
import com.ava.digitaldeck.model.UpdatePlayModeRequest;

import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.HashMap;
import java.util.Optional;
import java.util.List;
import java.util.Map;

@RestController
@CrossOrigin(origins = "http://localhost:3000")
@RequestMapping("/api/sessions")
public class SessionController {

    private final SessionService sessionService;
    private final DeckService deckService;
    private final SimpMessagingTemplate messagingTemplate;
    private final TurnService turnService;
    private final LobbySettingsService lobbySettingsService;
    private final TurnActionPolicy turnActionPolicy;
    private final GameStartService gameStartService;

    // For PATCH / lobby settings
    private ResponseEntity<?> toResponse(LobbySettingsService.UpdateResult result) {
        return switch (result) {
            case LobbySettingsService.UpdateResult.NotFound() ->
                    ResponseEntity.notFound().build();
            case LobbySettingsService.UpdateResult.Forbidden(String error) ->
                    ResponseEntity.status(403).body(Map.of("error", error));
            case LobbySettingsService.UpdateResult.Conflict(String error) ->
                    ResponseEntity.status(409).body(Map.of("error", error));
            case LobbySettingsService.UpdateResult.Ok(Object body) ->
                    ResponseEntity.ok(body);
        };
    }

    // For POST /deck/init
    private ResponseEntity<?> toStartResponse(GameStartService.StartResult result) {
        return switch (result) {
            case GameStartService.StartResult.NotFound() ->
                    ResponseEntity.notFound().build();
            case GameStartService.StartResult.Forbidden(String error) ->
                    ResponseEntity.status(403).body(Map.of("error", error));
            case GameStartService.StartResult.Conflict(String error) ->
                    ResponseEntity.status(409).body(Map.of("error", error));
            case GameStartService.StartResult.BadRequest(Object body) ->
                    ResponseEntity.badRequest().body(body);
            case GameStartService.StartResult.Ok(Object body) ->
                    ResponseEntity.ok(body);
        };
    }

    private void maybeAdvanceTurn(String sessionId, boolean advance) {
        if (!advance) return;
        String nextPlayer = turnService.advanceTurn(sessionId).orElse(null);
        messagingTemplate.convertAndSend(
                "/topic/session/" + sessionId,
                new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", nextPlayer)));
    }

    @Autowired
    public SessionController( SessionService sessionService, 
        DeckService deckService, 
        SimpMessagingTemplate messagingTemplate, 
        TurnService turnService, 
        LobbySettingsService lobbySettingsService, 
        TurnActionPolicy turnActionPolicy,
        GameStartService gameStartService) {

        this.sessionService = sessionService;
        this.deckService = deckService;
        this.messagingTemplate = messagingTemplate;
        this.turnService = turnService;
        this.lobbySettingsService = lobbySettingsService;
        this.turnActionPolicy = turnActionPolicy;
        this.gameStartService = gameStartService;
    }

    @PostMapping
    public Map<String, Object> createSession(@RequestBody(required = false) CreateSessionRequest request) {
        GameMode mode = GameMode.from(request == null ? null : request.gameMode());
        DiscardMode discardMode = DiscardMode.from(request == null ? null : request.discardMode());
        PlayMode playMode = PlayMode.from(request == null ? null : request.playMode());
        int deckCount = SessionService.clampDeckCount(request == null ? null : request.deckCount());
        int cardsPerPlayer = SessionService.clampCardsPerPlayer(
                request == null ? null : request.cardsPerPlayer());


                
        String code = sessionService.createSession(mode, discardMode, playMode, deckCount, cardsPerPlayer);
        return Map.of(
                "code", code,
                "gameMode", mode.name(),
                "discardMode", discardMode.name(),
                "playMode", playMode.name(),
                "deckCount", deckCount,
                "cardsPerPlayer", cardsPerPlayer
        );
    }

    @GetMapping("/{code}")
    public ResponseEntity<?> resolveSession(@PathVariable String code) {
        return sessionService.resolveCode(code)
                .map(sessionId -> ResponseEntity.ok(Map.of("sessionId", sessionId)))
                .orElse(ResponseEntity.notFound().build());
    }
    
    @PostMapping("/{sessionId}/deck/init")
    public ResponseEntity<?> initDeck(@PathVariable String sessionId, @RequestParam String playerId) {
        return toStartResponse(gameStartService.startGame(sessionId, playerId));
    }

    @GetMapping("/{sessionId}/hand")
    public ResponseEntity<?> getHand(@PathVariable String sessionId, @RequestParam String playerId) {
        if (!sessionService.sessionExists(sessionId)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("hand", deckService.getHand(sessionId, playerId)));
    }

    @PostMapping("/{sessionId}/draw")
    public ResponseEntity<?> draw(@PathVariable String sessionId, @RequestBody DrawRequest request) {
        if (!sessionService.sessionExists(sessionId)) {
            return ResponseEntity.notFound().build();
        }

        TurnActionPolicy.Permit permit = turnActionPolicy.permitDraw(sessionId, request.playerId());
        if (permit instanceof TurnActionPolicy.Permit.Denied(String error)) {
            return ResponseEntity.status(403).body(Map.of("error", error));
        }
        boolean advanceTurn = ((TurnActionPolicy.Permit.Allowed) permit).advanceTurnAfter();

        Optional<DeckService.DrawResult> drawn = deckService.drawCard(sessionId, request.playerId());
        if (drawn.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "deck is empty"));
        }

        DeckService.DrawResult result = drawn.get();
        String topDiscard = deckService.getTopDiscard(sessionId).orElse(null);

        Map<String, Object> payload = new HashMap<>();
        payload.put("playerId", request.playerId());
        payload.put("remaining", deckService.remainingCount(sessionId));
        payload.put("reshuffled", result.reshuffled());
        payload.put("topDiscard", topDiscard);

        messagingTemplate.convertAndSend(
                "/topic/session/" + sessionId,
                new SessionEvent("CARD_DRAWN", sessionId, payload));

        maybeAdvanceTurn(sessionId, advanceTurn);

        Map<String, Object> body = new HashMap<>();
        body.put("card", result.card());
        body.put("reshuffled", result.reshuffled());
        body.put("topDiscard", topDiscard);
        return ResponseEntity.ok(body);
    }

    @PostMapping("/{sessionId}/discard")
    public ResponseEntity<?> discard(@PathVariable String sessionId, @RequestBody DiscardRequest request) {
        if (!sessionService.sessionExists(sessionId)) {
            return ResponseEntity.notFound().build();
        }
    
        List<String> cards = request.cards();
        if (cards == null || cards.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "no cards"));
        }
    
        TurnActionPolicy.Permit permit = turnActionPolicy.permitDiscard(sessionId, request.playerId());
        if (permit instanceof TurnActionPolicy.Permit.Denied(String error)) {
            return ResponseEntity.status(403).body(Map.of("error", error));
        }
        boolean advanceTurn = ((TurnActionPolicy.Permit.Allowed) permit).advanceTurnAfter();
    
        String source = request.source() == null ? "HAND" : request.source().trim().toUpperCase();
        List<String> discarded = "PLAY".equals(source)
                ? deckService.discardCardsFromPlay(sessionId, request.playerId(), cards)
                : deckService.discardCards(sessionId, request.playerId(), cards);
    
        String notFoundError = "PLAY".equals(source) ? "card not in play" : "card not in hand";
        String partialError = "PLAY".equals(source) ? "some cards not in play" : "some cards not in hand";
    
        if (discarded.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", notFoundError));
        }
        if (discarded.size() != cards.size()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", partialError,
                    "discarded", discarded,
                    "topDiscard", discarded.get(discarded.size() - 1)
            ));
        }
    
        String topDiscard = discarded.get(discarded.size() - 1);
    
        Map<String, Object> payload = new HashMap<>();
        payload.put("playerId", request.playerId());
        payload.put("cards", discarded);
        payload.put("topDiscard", topDiscard);
        payload.put("source", source);
    
        messagingTemplate.convertAndSend(
                "/topic/session/" + sessionId,
                new SessionEvent("CARD_DISCARDED", sessionId, payload));
    
        maybeAdvanceTurn(sessionId, advanceTurn);
    
        return ResponseEntity.ok(Map.of(
                "cards", discarded,
                "topDiscard", topDiscard,
                "source", source
        ));
    }

    @PatchMapping("/{sessionId}/game-mode")
    public ResponseEntity<?> updateGameMode(
            @PathVariable String sessionId,
            @RequestBody UpdateGameModeRequest request) {
    
        GameMode mode = GameMode.from(request.gameMode());
    
        return toResponse(lobbySettingsService.updateWhileInLobby(
                sessionId,
                request.playerId(),
                () -> sessionService.setGameMode(sessionId, mode),
                "GAME_MODE_CHANGED",
                () -> Map.of("gameMode", mode.name()),
                () -> Map.of("gameMode", mode.name())
        ));
    }
    
    @PatchMapping("/{sessionId}/discard-mode")
    public ResponseEntity<?> updateDiscardMode(
            @PathVariable String sessionId,
            @RequestBody UpdateDiscardModeRequest request) {
    
        DiscardMode discardMode = DiscardMode.from(request.discardMode());
    
        return toResponse(lobbySettingsService.updateWhileInLobby(
                sessionId,
                request.playerId(),
                () -> sessionService.setDiscardMode(sessionId, discardMode),
                "DISCARD_MODE_CHANGED",
                () -> Map.of("discardMode", discardMode.name()),
                () -> Map.of("discardMode", discardMode.name())
        ));
    }
    
    @PatchMapping("/{sessionId}/deck-count")
    public ResponseEntity<?> updateDeckCount(
            @PathVariable String sessionId,
            @RequestBody UpdateDeckCountRequest request) {
    
        int deckCount = SessionService.clampDeckCount(request.deckCount());
    
        return toResponse(lobbySettingsService.updateWhileInLobby(
                sessionId,
                request.playerId(),
                () -> sessionService.setDeckCount(sessionId, deckCount),
                "DECK_COUNT_CHANGED",
                () -> Map.of("deckCount", deckCount),
                () -> Map.of("deckCount", deckCount)
        ));
    }
    
    @PatchMapping("/{sessionId}/cards-per-player")
    public ResponseEntity<?> updateCardsPerPlayer(
            @PathVariable String sessionId,
            @RequestBody UpdateCardsPerPlayerRequest request) {
    
        int cardsPerPlayer = SessionService.clampCardsPerPlayer(request.cardsPerPlayer());
    
        return toResponse(lobbySettingsService.updateWhileInLobby(
                sessionId,
                request.playerId(),
                () -> sessionService.setCardsPerPlayer(sessionId, cardsPerPlayer),
                "CARDS_PER_PLAYER_CHANGED",
                () -> Map.of("cardsPerPlayer", cardsPerPlayer),
                () -> Map.of("cardsPerPlayer", cardsPerPlayer)
        ));
    }

    @PostMapping("/{sessionId}/play")
    public ResponseEntity<?> play(@PathVariable String sessionId, @RequestBody PlayRequest request) {
        if (!sessionService.sessionExists(sessionId)) {
            return ResponseEntity.notFound().build();
        }
        List<String> cards = request.cards();
        if (cards == null || cards.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "no cards"));
        }
    
        TurnActionPolicy.Permit permit = turnActionPolicy.permitPlay(sessionId, request.playerId());
        if (permit instanceof TurnActionPolicy.Permit.Denied(String error)) {
            return ResponseEntity.status(403).body(Map.of("error", error));
        }
    
        List<String> played = deckService.playCards(sessionId, request.playerId(), cards);
        if (played.isEmpty() || played.size() != cards.size()) {
            return ResponseEntity.badRequest().body(Map.of("error", "card not in hand", "played", played));
        }
    
        Map<String, Object> payload = new HashMap<>();
        payload.put("playerId", request.playerId());
        payload.put("cards", played);
        payload.put("playArea", deckService.getPlayArea(sessionId, request.playerId()));
    
        messagingTemplate.convertAndSend(
                "/topic/session/" + sessionId,
                new SessionEvent("CARDS_PLAYED", sessionId, payload));
    
        // do NOT maybeAdvanceTurn
        return ResponseEntity.ok(Map.of(
                "cards", played,
                "playArea", payload.get("playArea")
        ));
    }

    @PatchMapping("/{sessionId}/play-mode")
    public ResponseEntity<?> updatePlayMode(
            @PathVariable String sessionId,
            @RequestBody UpdatePlayModeRequest request) {
    
        PlayMode playMode = PlayMode.from(request.playMode());
    
        return toResponse(lobbySettingsService.updateWhileInLobby(
                sessionId,
                request.playerId(),
                () -> sessionService.setPlayMode(sessionId, playMode),
                "PLAY_MODE_CHANGED",
                () -> Map.of("playMode", playMode.name()),
                () -> Map.of("playMode", playMode.name())
        ));
    }


}