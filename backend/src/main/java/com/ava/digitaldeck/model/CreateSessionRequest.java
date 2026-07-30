package com.ava.digitaldeck.model;

public record CreateSessionRequest(
    String gameMode,
    String discardMode,
    String playMode,
    Integer deckCount,
    Integer cardsPerPlayer
) {}