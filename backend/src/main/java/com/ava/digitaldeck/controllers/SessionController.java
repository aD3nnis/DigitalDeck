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

import org.springframework.messaging.simp.SimpMessagingTemplate;

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
    public Map<String, String> createSession(@RequestBody(required = false) CreateSessionRequest request) {
        GameMode mode = GameMode.from(request == null ? null : request.gameMode());
        String code = sessionService.createSession(mode);
        return Map.of("code", code, "gameMode", mode.name());
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
    
        deckService.initializeDeck(sessionId);
    
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
    
        if (mode == GameMode.TURN_ROTATION) {
            Optional<String> currentPlayer = turnService.getCurrentPlayer(sessionId);
            if (currentPlayer.isEmpty() || !currentPlayer.get().equals(request.playerId())) {
                return ResponseEntity.status(403).body(Map.of("error", "not your turn"));
            }
        }
    
        Optional<String> card = deckService.drawCard(sessionId, request.playerId());
        if (card.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "deck is empty"));
    
        messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                new SessionEvent("CARD_DRAWN", sessionId, Map.of(
                        "playerId", request.playerId(),
                        "remaining", deckService.remainingCount(sessionId)
                )));
    
        if (mode == GameMode.TURN_ROTATION) {
            String nextPlayer = turnService.advanceTurn(sessionId).orElse(null);
            messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                    new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", nextPlayer)));
        }
    
        return ResponseEntity.ok(Map.of("card", card.get()));
    } 

    @GetMapping("/{sessionId}/hand")
    public ResponseEntity<?> getHand(@PathVariable String sessionId, @RequestParam String playerId) {
        if (!sessionService.sessionExists(sessionId)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("hand", deckService.getHand(sessionId, playerId)));
    }
}