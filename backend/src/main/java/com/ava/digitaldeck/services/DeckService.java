package com.ava.digitaldeck.services;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;

@Service
public class DeckService {

    private static final String[] RANKS = {"2","3","4","5","6","7","8","9","10","J","Q","K","A"};
    private static final String[] SUITS = {"H","D","C","S"};
    private static final Duration SESSION_TTL = Duration.ofHours(4);

    private final StringRedisTemplate redisTemplate;

    @Autowired
    public DeckService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void initializeDeck(String sessionId) {
        List<String> cards = new ArrayList<>();
        for (String suit : SUITS) {
            for (String rank : RANKS) {
                cards.add(rank + suit);
            }
        }
        Collections.shuffle(cards);

        String deckKey = "session:" + sessionId + ":deck";
        redisTemplate.delete(deckKey);
        redisTemplate.opsForList().rightPushAll(deckKey, cards);
        redisTemplate.expire(deckKey, SESSION_TTL);
    }

    public Optional<String> drawCard(String sessionId, String playerId) {
        String deckKey = "session:" + sessionId + ":deck";
        String card = redisTemplate.opsForList().leftPop(deckKey);
        if (card == null) {
            return Optional.empty();
        }

        String handKey = "session:" + sessionId + ":hands:" + playerId;
        redisTemplate.opsForList().rightPush(handKey, card);
        redisTemplate.expire(handKey, SESSION_TTL);

        return Optional.of(card);
    }

    public long remainingCount(String sessionId) {
        Long size = redisTemplate.opsForList().size("session:" + sessionId + ":deck");
        return size == null ? 0 : size;
    }
}