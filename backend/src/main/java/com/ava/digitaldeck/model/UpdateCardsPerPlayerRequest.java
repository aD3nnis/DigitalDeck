package com.ava.digitaldeck.model;

public record UpdateCardsPerPlayerRequest(Integer cardsPerPlayer, String playerId) {}