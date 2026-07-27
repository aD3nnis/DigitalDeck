package com.ava.digitaldeck.services;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

@Service
public class TurnService {

    private static final Duration SESSION_TTL = Duration.ofHours(4);
    private final StringRedisTemplate redisTemplate;

    @Autowired
    public TurnService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void startTurns(String sessionId) {
        List<String> order = redisTemplate.opsForList().range(orderKey(sessionId), 0, -1);
        if (order != null && !order.isEmpty()) {
            redisTemplate.opsForValue().set(currentKey(sessionId), order.get(0), SESSION_TTL);
        }
    }

    public Optional<String> getCurrentPlayer(String sessionId) {
        return Optional.ofNullable(redisTemplate.opsForValue().get(currentKey(sessionId)));
    }

    public Optional<String> advanceTurn(String sessionId) {
        List<String> order = redisTemplate.opsForList().range(orderKey(sessionId), 0, -1);
        if (order == null || order.isEmpty()) return Optional.empty();

        String current = redisTemplate.opsForValue().get(currentKey(sessionId));
        int idx = current == null ? -1 : order.indexOf(current);
        String next = order.get((idx + 1) % order.size());

        redisTemplate.opsForValue().set(currentKey(sessionId), next, SESSION_TTL);
        return Optional.of(next);
    }

    /** Call this BEFORE removing the player from playerOrder. */
    public Optional<String> handlePlayerLeft(String sessionId, String playerId) {
        String current = redisTemplate.opsForValue().get(currentKey(sessionId));
        if (current == null || !current.equals(playerId)) {
            return Optional.ofNullable(current); // wasn't their turn — nothing to do
        }

        List<String> order = redisTemplate.opsForList().range(orderKey(sessionId), 0, -1);
        if (order == null || order.isEmpty()) {
            redisTemplate.delete(currentKey(sessionId));
            return Optional.empty();
        }

        int idx = order.indexOf(playerId);
        for (int i = 1; i <= order.size(); i++) {
            String candidate = order.get((idx + i) % order.size());
            if (!candidate.equals(playerId)) {
                redisTemplate.opsForValue().set(currentKey(sessionId), candidate, SESSION_TTL);
                return Optional.of(candidate);
            }
        }

        redisTemplate.delete(currentKey(sessionId)); // everyone left
        return Optional.empty();
    }

    private String currentKey(String sessionId) { return "session:" + sessionId + ":currentTurnPlayer"; }
    private String orderKey(String sessionId) { return "session:" + sessionId + ":playerOrder"; }
}