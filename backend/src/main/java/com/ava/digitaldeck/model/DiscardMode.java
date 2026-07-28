package com.ava.digitaldeck.model;

public enum DiscardMode {
    DISCARD_OFF,
    TURN_DISCARD,
    FREE_DISCARD;

    public static DiscardMode from(String value) {
        if (value == null || value.isBlank()) {
            return DISCARD_OFF; // default: current behavior
        }
        return DiscardMode.valueOf(value.trim().toUpperCase());
    }
}