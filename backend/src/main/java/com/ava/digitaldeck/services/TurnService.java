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
        redisTemplate.opsForValue().set("session:" + sessionId + ":turnIndex", "0", SESSION_TTL);
    }

    public Optional<String> getCurrentPlayer(String sessionId) {
        List<String> order = redisTemplate.opsForList().range("session:" + sessionId + ":playerOrder", 0, -1);
        if (order == null || order.isEmpty()) return Optional.empty();

        String indexStr = redisTemplate.opsForValue().get("session:" + sessionId + ":turnIndex");
        int index = (indexStr == null ? 0 : Integer.parseInt(indexStr)) % order.size();
        return Optional.of(order.get(index));
    }

    public Optional<String> advanceTurn(String sessionId) {
        List<String> order = redisTemplate.opsForList().range("session:" + sessionId + ":playerOrder", 0, -1);
        if (order == null || order.isEmpty()) return Optional.empty();

        String turnIndexKey = "session:" + sessionId + ":turnIndex";
        String indexStr = redisTemplate.opsForValue().get(turnIndexKey);
        int nextIndex = ((indexStr == null ? 0 : Integer.parseInt(indexStr)) + 1) % order.size();

        redisTemplate.opsForValue().set(turnIndexKey, String.valueOf(nextIndex), SESSION_TTL);
        return Optional.of(order.get(nextIndex));
    }
}