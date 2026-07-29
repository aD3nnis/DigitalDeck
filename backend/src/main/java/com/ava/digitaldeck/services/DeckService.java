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

    public void initializeDeck(String sessionId, int deckCount) {
        int packs = Math.max(1, Math.min(3, deckCount));
        List<String> cards = new ArrayList<>();
        for (int i = 0; i < packs; i++) {
            for (String suit : SUITS) {
                for (String rank : RANKS) {
                    cards.add(rank + suit);
                }
            }
        }
        Collections.shuffle(cards);
    
        String deckKey = "session:" + sessionId + ":deck";
        String discardKey = "session:" + sessionId + ":discard";
    
        redisTemplate.delete(deckKey);
        redisTemplate.delete(discardKey);
        redisTemplate.opsForList().rightPushAll(deckKey, cards);
        redisTemplate.expire(deckKey, SESSION_TTL);
    }

    /**
     * Deal cardsPerPlayer to each player from the top of the draw pile.
     * Caller must ensure enough cards remain.
     * Returns total cards dealt.
     */
    public int dealStartingHands(String sessionId, List<String> playerIds, int cardsPerPlayer) {
        if (cardsPerPlayer <= 0 || playerIds == null || playerIds.isEmpty()) {
            return 0;
        }
        String deckKey = "session:" + sessionId + ":deck";
        int dealt = 0;
        for (String playerId : playerIds) {
            String handKey = "session:" + sessionId + ":hands:" + playerId;
            // Clear any leftover hand key from a previous abandoned attempt
            redisTemplate.delete(handKey);
            for (int i = 0; i < cardsPerPlayer; i++) {
                String card = redisTemplate.opsForList().leftPop(deckKey);
                if (card == null) {
                    return dealt;
                }
                redisTemplate.opsForList().rightPush(handKey, card);
                dealt++;
            }
            redisTemplate.expire(handKey, SESSION_TTL);
        }
        return dealt;
    }
    
    /** Moves card from hand → discard pile. Empty if card not in hand. */
    public Optional<String> discardCard(String sessionId, String playerId, String card) {
        if (card == null || card.isBlank()) return Optional.empty();
    
        String handKey = "session:" + sessionId + ":hands:" + playerId;
        Long removed = redisTemplate.opsForList().remove(handKey, 1, card);
        if (removed == null || removed == 0) {
            return Optional.empty();
        }
    
        String discardKey = "session:" + sessionId + ":discard";
        redisTemplate.opsForList().rightPush(discardKey, card);
        redisTemplate.expire(discardKey, SESSION_TTL);
        redisTemplate.expire(handKey, SESSION_TTL);
    
        return Optional.of(card);
    }
    
    /** Top of discard = most recently discarded (rightmost). */
    public Optional<String> getTopDiscard(String sessionId) {
        String discardKey = "session:" + sessionId + ":discard";
        Long size = redisTemplate.opsForList().size(discardKey);
        if (size == null || size == 0) return Optional.empty();
        return Optional.ofNullable(redisTemplate.opsForList().index(discardKey, -1));
    }
    /** Result of a successful draw. */
    public record DrawResult(String card, boolean reshuffled) {}

    /**
     * Moves discard into draw deck (shuffled), leaving the top discard face-up when possible.
     * If discard has only 1 card and deck is empty, that card is reshuffled into the deck
     * (otherwise the game soft-locks).
     * Returns how many cards were moved into the draw deck.
     */
    public int reshuffleDiscardIntoDeck(String sessionId) {
        String deckKey = "session:" + sessionId + ":deck";
        String discardKey = "session:" + sessionId + ":discard";
        List<String> discard = redisTemplate.opsForList().range(discardKey, 0, -1);
        if (discard == null || discard.isEmpty()) {
            return 0;
        }
        String keepTop = null;
        // Leave top only when there is something underneath to reshuffle
        if (discard.size() > 1) {
            keepTop = discard.remove(discard.size() - 1);
        }
        Collections.shuffle(discard);
        redisTemplate.delete(discardKey);
        if (keepTop != null) {
            redisTemplate.opsForList().rightPush(discardKey, keepTop);
            redisTemplate.expire(discardKey, SESSION_TTL);
        }
        if (!discard.isEmpty()) {
            redisTemplate.opsForList().rightPushAll(deckKey, discard);
            redisTemplate.expire(deckKey, SESSION_TTL);
        }
        return discard.size();
    }
    public Optional<DrawResult> drawCard(String sessionId, String playerId) {
        String deckKey = "session:" + sessionId + ":deck";
        boolean reshuffled = false;
        String card = redisTemplate.opsForList().leftPop(deckKey);
        if (card == null) {
            int moved = reshuffleDiscardIntoDeck(sessionId);
            if (moved == 0) {
                return Optional.empty(); // deck empty AND discard empty/unusable
            }
            reshuffled = true;
            card = redisTemplate.opsForList().leftPop(deckKey);
            if (card == null) {
                return Optional.empty();
            }
        }
        String handKey = "session:" + sessionId + ":hands:" + playerId;
        redisTemplate.opsForList().rightPush(handKey, card);
        redisTemplate.expire(handKey, SESSION_TTL);
        return Optional.of(new DrawResult(card, reshuffled));
    }

    public long remainingCount(String sessionId) {
        Long size = redisTemplate.opsForList().size("session:" + sessionId + ":deck");
        return size == null ? 0 : size;
    }
    public List<String> getHand(String sessionId, String playerId) {
        List<String> hand = redisTemplate.opsForList().range("session:" + sessionId + ":hands:" + playerId, 0, -1);
        return hand == null ? List.of() : hand;
    }
}