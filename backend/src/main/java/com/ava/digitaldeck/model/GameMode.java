package com.ava.digitaldeck.model;

public enum GameMode {
    TURN_ROTATION,
    FREE_ROTATION;

    public static GameMode from(String value) {
        if (value == null || value.isBlank()) {
            return TURN_ROTATION; // default
        }
        return GameMode.valueOf(value.trim().toUpperCase());
    }
}