package com.ava.digitaldeck.model;

public enum PlayMode {
    PLAY_OFF,
    TURN_PLAY,
    FREE_PLAY;

    public static PlayMode from(String value) {
        if (value == null || value.isBlank()) {
            return PLAY_OFF;
        }
        return PlayMode.valueOf(value.trim().toUpperCase());
    }
}