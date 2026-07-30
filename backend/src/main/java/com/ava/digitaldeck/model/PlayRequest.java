package com.ava.digitaldeck.model;

import java.util.List;

public record PlayRequest(String playerId, List<String> cards) {}