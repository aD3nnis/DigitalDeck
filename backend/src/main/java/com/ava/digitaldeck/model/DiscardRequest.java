package com.ava.digitaldeck.model;

import java.util.List;

public record DiscardRequest(String playerId, List<String> cards) {}