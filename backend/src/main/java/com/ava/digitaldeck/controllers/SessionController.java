package com.ava.digitaldeck.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


import com.ava.digitaldeck.services.SessionService;
import com.ava.digitaldeck.services.DeckService;
import com.ava.digitaldeck.services.TurnService;
import com.ava.digitaldeck.model.DrawRequest;
import com.ava.digitaldeck.model.SessionEvent;

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
    public Map<String, String> createSession() {
        String code = sessionService.createSession();
        return Map.of("code", code);
    }

    @GetMapping("/{code}")
    public ResponseEntity<?> resolveSession(@PathVariable String code) {
        return sessionService.resolveCode(code)
                .map(sessionId -> ResponseEntity.ok(Map.of("sessionId", sessionId)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{sessionId}/deck/init")
    public ResponseEntity<?> initDeck(@PathVariable String sessionId) {
        if (!sessionService.sessionExists(sessionId)) return ResponseEntity.notFound().build();

        deckService.initializeDeck(sessionId);
        turnService.startTurns(sessionId);
        String currentPlayer = turnService.getCurrentPlayer(sessionId).orElse(null);

        messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                new SessionEvent("DECK_INITIALIZED", sessionId, Map.of("remaining", deckService.remainingCount(sessionId))));
        messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", currentPlayer)));

        return ResponseEntity.ok(Map.of("remaining", deckService.remainingCount(sessionId), "currentTurn", currentPlayer));
    }

    @PostMapping("/{sessionId}/draw")
    public ResponseEntity<?> draw(@PathVariable String sessionId, @RequestBody DrawRequest request) {
        if (!sessionService.sessionExists(sessionId)) return ResponseEntity.notFound().build();

        Optional<String> currentPlayer = turnService.getCurrentPlayer(sessionId);
        if (currentPlayer.isEmpty() || !currentPlayer.get().equals(request.playerId())) {
            return ResponseEntity.status(403).body(Map.of("error", "not your turn"));
        }

        Optional<String> card = deckService.drawCard(sessionId, request.playerId());
        if (card.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "deck is empty"));

        String nextPlayer = turnService.advanceTurn(sessionId).orElse(null);

        messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                new SessionEvent("CARD_DRAWN", sessionId, Map.of("playerId", request.playerId(), "remaining", deckService.remainingCount(sessionId))));
        messagingTemplate.convertAndSend("/topic/session/" + sessionId,
                new SessionEvent("TURN_CHANGED", sessionId, Map.of("playerId", nextPlayer)));

        return ResponseEntity.ok(Map.of("card", card.get()));
    }    
}