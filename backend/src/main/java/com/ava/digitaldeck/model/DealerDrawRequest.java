package com.ava.digitaldeck.model;

import java.util.List;

public record DealerDrawRequest(String playerId, List<String> slots) {}
