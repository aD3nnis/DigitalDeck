package com.ava.digitaldeck.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


import com.ava.digitaldeck.services.SessionService;
import com.ava.digitaldeck.services.DeckService;
import com.ava.digitaldeck.services.TurnService;
import com.ava.digitaldeck.model.DrawRequest;
import com.ava.digitaldeck.model.SessionEvent;
import com.ava.digitaldeck.model.CreateSessionRequest;
import com.ava.digitaldeck.model.GameMode;
import com.ava.digitaldeck.model.UpdateGameModeRequest;
import com.ava.digitaldeck.model.DiscardMode;
import com.ava.digitaldeck.model.DiscardRequest;
import com.ava.digitaldeck.model.UpdateDiscardModeRequest;
import com.ava.digitaldeck.model.UpdateDeckCountRequest;

import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.HashMap;
import java.util.Optional;
import java.util.Map;

@RestController
@CrossOrigin(origins = "http://localhost:3000")
@RequestMapping("/api/sessions")
public class SessionController {

    private final SessionService sessionService;
    private final DeckService deckService;
    private final SimpMessagingTemplate messagingTemplate;
    private final TurnService turnService;

    @Autowired
    public SessionController(SessionService sessionService, DeckService deckService, SimpMessagingTemplate messagingTemplate, TurnService turnService) {
        this.sessionService = sessionService;
        this.deckService = deckService;
        this.messagingTemplate = messagingTemplate;
        this.turnService = turnService;
    }

    @PostMapping
    public Map<String, Object> createSession(@RequestBody(required = false) CreateSessionRequest request) {
        GameMode mode = GameMode.from(request == null ? null : request.gameMode());
        DiscardMode discardMode = DiscardMode.from(request == null ? null : request.discardMode());
        int deckCount = SessionService.clampDeckCount(request == null ? null : request.deckCount());
        String code = sessionService.createSession(mode, discardMode, deckCount);
        return Map.of(
                "code", code,
                "gameMode", mode.name(),
                "discardMode", discardMode.name(),
                "deckCount", deckCount
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
        if (!sessionService.sessionExists(sessionId)) return ResponseEntity.notFound().build();
    
        Optional<String> host = sessionService.getHost(sessionId);
        if (host.isEmpty() || !host.get().equals(playerId)) {
            return ResponseEntity.status(403).body(Map.of("error", "only the host can start the game"));
        }
        if (sessionService.gameStarted(sessionId)) {
            return ResponseEntity.status(409).body(Map.of("error", "game already started"));
        }
    
        int deckCount = sessionService.getDeckCount(sessionId);
        deckService.initializeDeck(sessionId, deckCount);
    
        GameMode mode = sessionService.getGameMode(sessionId);
        String currentPlayer = null;
    
        messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                new SessionEvent("DECK_INITIALIZED", sessionId, Map.of(
                        "remaining", deckService.remainingCount(sessionId),
                        "gameMode", mode.name()
                )));
    
        if (mode == GameMode.TURN_ROTATION) {
            turnService.startTurns(sessionId);
            currentPlayer = turnService.getCurrentPlayer(sessionId).orElse(null);
            messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                    new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", currentPlayer)));
        }
    
        return ResponseEntity.ok(Map.of(
                "remaining", deckService.remainingCount(sessionId),
                "currentTurn", currentPlayer,
                "gameMode", mode.name()
        ));
    }

    @PostMapping("/{sessionId}/draw")
    public ResponseEntity<?> draw(@PathVariable String sessionId, @RequestBody DrawRequest request) {
        if (!sessionService.sessionExists(sessionId)) return ResponseEntity.notFound().build();
    
        GameMode mode = sessionService.getGameMode(sessionId);
        DiscardMode discardMode = sessionService.getDiscardMode(sessionId);
    
        if (mode == GameMode.TURN_ROTATION) {
            Optional<String> currentPlayer = turnService.getCurrentPlayer(sessionId);
            if (currentPlayer.isEmpty() || !currentPlayer.get().equals(request.playerId())) {
                return ResponseEntity.status(403).body(Map.of("error", "not your turn"));
            }
        }
    
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
    
        boolean advanceOnDraw =
                mode == GameMode.TURN_ROTATION && discardMode != DiscardMode.TURN_DISCARD;
    
        if (advanceOnDraw) {
            String nextPlayer = turnService.advanceTurn(sessionId).orElse(null);
            messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                    new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", nextPlayer)));
        }
    
        Map<String, Object> body = new HashMap<>();
        body.put("card", result.card());
        body.put("reshuffled", result.reshuffled());
        body.put("remaining", deckService.remainingCount(sessionId));
        body.put("topDiscard", topDiscard);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/{sessionId}/hand")
    public ResponseEntity<?> getHand(@PathVariable String sessionId, @RequestParam String playerId) {
        if (!sessionService.sessionExists(sessionId)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("hand", deckService.getHand(sessionId, playerId)));
    }

    @PatchMapping("/{sessionId}/game-mode")
    public ResponseEntity<?> updateGameMode(
            @PathVariable String sessionId,
            @RequestBody UpdateGameModeRequest request) {

        if (!sessionService.sessionExists(sessionId)) {
            return ResponseEntity.notFound().build();
        }

        Optional<String> host = sessionService.getHost(sessionId);
        if (host.isEmpty() || !host.get().equals(request.playerId())) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "only the host can change game mode"));
        }

        if (sessionService.gameStarted(sessionId)) {
            return ResponseEntity.status(409)
                    .body(Map.of("error", "game already started"));
        }

        GameMode mode = GameMode.from(request.gameMode());
        sessionService.setGameMode(sessionId, mode);

        messagingTemplate.convertAndSend(
                "/topic/session/" + sessionId,
                new SessionEvent("GAME_MODE_CHANGED", sessionId,
                        Map.of("gameMode", mode.name())));

        return ResponseEntity.ok(Map.of("gameMode", mode.name()));
    }
    @PostMapping("/{sessionId}/discard")
    public ResponseEntity<?> discard(@PathVariable String sessionId, @RequestBody DiscardRequest request) {
        if (!sessionService.sessionExists(sessionId)) return ResponseEntity.notFound().build();

        DiscardMode discardMode = sessionService.getDiscardMode(sessionId);
        if (discardMode == DiscardMode.DISCARD_OFF) {
            return ResponseEntity.status(403).body(Map.of("error", "discard is disabled"));
        }

        GameMode mode = sessionService.getGameMode(sessionId);

        if (discardMode == DiscardMode.TURN_DISCARD) {
            Optional<String> currentPlayer = turnService.getCurrentPlayer(sessionId);
            if (currentPlayer.isEmpty() || !currentPlayer.get().equals(request.playerId())) {
                return ResponseEntity.status(403).body(Map.of("error", "not your turn"));
            }
        }

        Optional<String> discarded = deckService.discardCard(sessionId, request.playerId(), request.card());
        if (discarded.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "card not in hand"));
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("playerId", request.playerId());
        payload.put("card", discarded.get());
        payload.put("topDiscard", discarded.get());

        messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                new SessionEvent("CARD_DISCARDED", sessionId, payload));

        // Turn Rotation + Turn Discard: discard ends the turn
        if (mode == GameMode.TURN_ROTATION && discardMode == DiscardMode.TURN_DISCARD) {
            String nextPlayer = turnService.advanceTurn(sessionId).orElse(null);
            messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                    new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", nextPlayer)));
        }

        return ResponseEntity.ok(Map.of(
                "card", discarded.get(),
                "topDiscard", discarded.get()
        ));
    }
    @PatchMapping("/{sessionId}/discard-mode")
    public ResponseEntity<?> updateDiscardMode(
            @PathVariable String sessionId,
            @RequestBody UpdateDiscardModeRequest request) {

        if (!sessionService.sessionExists(sessionId)) {
            return ResponseEntity.notFound().build();
        }

        Optional<String> host = sessionService.getHost(sessionId);
        if (host.isEmpty() || !host.get().equals(request.playerId())) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "only the host can change discard mode"));
        }

        if (sessionService.gameStarted(sessionId)) {
            return ResponseEntity.status(409)
                    .body(Map.of("error", "game already started"));
        }

        DiscardMode discardMode = DiscardMode.from(request.discardMode());
        sessionService.setDiscardMode(sessionId, discardMode);

        messagingTemplate.convertAndSend(
                "/topic/session/" + sessionId,
                new SessionEvent("DISCARD_MODE_CHANGED", sessionId,
                        Map.of("discardMode", discardMode.name())));

        return ResponseEntity.ok(Map.of("discardMode", discardMode.name()));
    }
    @PatchMapping("/{sessionId}/deck-count")
    public ResponseEntity<?> updateDeckCount(
        @PathVariable String sessionId,
        @RequestBody UpdateDeckCountRequest request) {

    if (!sessionService.sessionExists(sessionId)) {
        return ResponseEntity.notFound().build();
    }

    Optional<String> host = sessionService.getHost(sessionId);
    if (host.isEmpty() || !host.get().equals(request.playerId())) {
        return ResponseEntity.status(403)
                .body(Map.of("error", "only the host can change deck count"));
    }

    if (sessionService.gameStarted(sessionId)) {
        return ResponseEntity.status(409)
                .body(Map.of("error", "game already started"));
    }

    int deckCount = SessionService.clampDeckCount(request.deckCount());
    sessionService.setDeckCount(sessionId, deckCount);

    messagingTemplate.convertAndSend(
            "/topic/session/" + sessionId,
            new SessionEvent("DECK_COUNT_CHANGED", sessionId,
                    Map.of("deckCount", deckCount)));

    return ResponseEntity.ok(Map.of("deckCount", deckCount));
    }


}