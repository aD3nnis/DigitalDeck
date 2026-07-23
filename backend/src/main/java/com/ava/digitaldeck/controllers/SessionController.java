package com.ava.digitaldeck.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.ava.digitaldeck.services.SessionService;

import java.util.Map;

@RestController
@CrossOrigin(origins = "http://localhost:3000")
@RequestMapping("/api/sessions")
public class SessionController {

    private final SessionService sessionService;

    @Autowired
    public SessionController(SessionService sessionService) {
        this.sessionService = sessionService;
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
}