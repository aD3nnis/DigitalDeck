package com.ava.digitaldeck.model;

import java.util.List;

/** source: "HAND" (default), "PLAY", or "DEALER" */
public record DiscardRequest(String playerId, List<String> cards, String source) {}
