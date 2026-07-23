package com.ava.digitaldeck.model;

import java.time.Instant;

public record SessionEvent(String type, String sessionId, Object payload, Instant timestamp) {
    public SessionEvent(String type, String sessionId, Object payload) {
        this(type, sessionId, payload, Instant.now());
    }
}