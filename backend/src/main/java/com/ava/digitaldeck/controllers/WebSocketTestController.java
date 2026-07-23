package com.ava.digitaldeck.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.util.Map;

@Controller
public class WebSocketTestController {

    @MessageMapping("/test")
    public Map<String, String> handleTest(Map<String, String> payload) {
        return Map.of("echo", payload.get("message"), "receivedAt", java.time.Instant.now().toString());
    }
}