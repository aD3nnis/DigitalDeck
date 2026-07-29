package com.ava.digitaldeck.model;

public record CreateSessionRequest(
        String gameMode,
        String discardMode,
        Integer deckCount,
        Integer cardsPerPlayer
) {}