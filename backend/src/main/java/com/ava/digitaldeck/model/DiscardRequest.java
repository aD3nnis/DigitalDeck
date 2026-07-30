package com.ava.digitaldeck.model;

import java.util.List;

/** source: "HAND" (default) or "PLAY" */
public record DiscardRequest(String playerId, List<String> cards, String source) {}