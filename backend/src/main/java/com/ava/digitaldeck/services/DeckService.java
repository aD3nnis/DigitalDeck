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

    /** Discards cards in order; last successful card is top of discard. */
    public List<String> discardCards(String sessionId, String playerId, List<String> cards) {
        if (cards == null || cards.isEmpty()) return List.of();

        List<String> discarded = new ArrayList<>();
        for (String card : cards) {
            Optional<String> one = discardCard(sessionId, playerId, card);
            if (one.isEmpty()) {
                // stop on first missing card; already-discarded stay discarded
                break;
            }
            discarded.add(one.get());
        }
        return discarded;
    }

    public List<String> discardCardsFromPlay(String sessionId, String playerId, List<String> cards) {
        if (cards == null || cards.isEmpty()) return List.of();

        List<String> discarded = new ArrayList<>();
        for (String card : cards) {
            Optional<String> one = discardFromPlay(sessionId, playerId, card);
            if (one.isEmpty()) break;
            discarded.add(one.get());
        }
        return discarded;
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
    private String playKey(String sessionId, String playerId) {
        return "session:" + sessionId + ":play:" + playerId;
    }
    public void clearPlayArea(String sessionId, String playerId) {
        redisTemplate.delete(playKey(sessionId, playerId));
    }
    
    public void clearAllPlayAreas(String sessionId, List<String> playerIds) {
        if (playerIds == null) return;
        for (String playerId : playerIds) {
            clearPlayArea(sessionId, playerId);
        }
    }
    public static final List<String> SLOT_IDS = List.of(
        "t01", "t02", "t03", "t04", "t05", "t06", "t07", "t08",
        "b01", "b02", "b03", "b04", "b05", "b06", "b07"
    );

    public record PlayAttempt(List<String> played, String error) {
        public boolean ok() { return error == null; }
    }

    /** Moves cards hand → slots starting at startSlot, left-to-right, wrapping t08→b01. */
    public PlayAttempt playCards(String sessionId, String playerId, List<String> cards, String startSlot) {
        if (cards == null || cards.isEmpty()) {
            return new PlayAttempt(List.of(), "no cards");
        }
        int start = SLOT_IDS.indexOf(startSlot);
        if (start < 0) {
            return new PlayAttempt(List.of(), "invalid slot");
        }
        if (start + cards.size() > SLOT_IDS.size()) {
            return new PlayAttempt(List.of(), "not enough slots");
        }

        String pKey = playKey(sessionId, playerId);
        Map<Object, Object> occupied = redisTemplate.opsForHash().entries(pKey);
        for (int i = 0; i < cards.size(); i++) {
            String slot = SLOT_IDS.get(start + i);
            Object existing = occupied.get(slot);
            if (existing != null && !existing.toString().isBlank()) {
                return new PlayAttempt(List.of(), "slot occupied");
            }
        }

        String handKey = "session:" + sessionId + ":hands:" + playerId;
        List<String> hand = getHand(sessionId, playerId);
        List<String> remainingHand = new ArrayList<>(hand);
        for (String card : cards) {
            if (card == null || card.isBlank()) {
                return new PlayAttempt(List.of(), "card not in hand");
            }
            int at = remainingHand.indexOf(card);
            if (at < 0) {
                return new PlayAttempt(List.of(), "card not in hand");
            }
            remainingHand.remove(at);
        }

        // Commit only after every check passes (no partial fill).
        for (String card : cards) {
            redisTemplate.opsForList().remove(handKey, 1, card);
        }
        for (int i = 0; i < cards.size(); i++) {
            redisTemplate.opsForHash().put(pKey, SLOT_IDS.get(start + i), cards.get(i));
        }
        redisTemplate.expire(handKey, SESSION_TTL);
        redisTemplate.expire(pKey, SESSION_TTL);
        return new PlayAttempt(List.copyOf(cards), null);
    }

    public Optional<String> discardFromPlay(String sessionId, String playerId, String card) {
        if (card == null || card.isBlank()) return Optional.empty();

        String pKey = playKey(sessionId, playerId);
        Map<Object, Object> occupied = redisTemplate.opsForHash().entries(pKey);
        String slotToClear = null;
        for (String slot : SLOT_IDS) {
            Object existing = occupied.get(slot);
            if (card.equals(existing)) {
                slotToClear = slot;
                break;
            }
        }
        if (slotToClear == null) return Optional.empty();

        redisTemplate.opsForHash().delete(pKey, slotToClear);
        String discardKey = "session:" + sessionId + ":discard";
        redisTemplate.opsForList().rightPush(discardKey, card);
        redisTemplate.expire(discardKey, SESSION_TTL);
        redisTemplate.expire(pKey, SESSION_TTL);
        return Optional.of(card);
    }

    /** Occupied slots only: { "b04": "AH", ... }. */
    public Map<String, String> getPlayArea(String sessionId, String playerId) {
        Map<Object, Object> raw = redisTemplate.opsForHash().entries(playKey(sessionId, playerId));
        Map<String, String> area = new LinkedHashMap<>();
        for (String slot : SLOT_IDS) {
            Object card = raw.get(slot);
            if (card != null && !card.toString().isBlank()) {
                area.put(slot, card.toString());
            }
        }
        return area;
    }

    public Map<String, Map<String, String>> getAllPlayAreas(String sessionId, List<String> playerIds) {
        Map<String, Map<String, String>> areas = new HashMap<>();
        if (playerIds == null) return areas;
        for (String id : playerIds) {
            areas.put(id, getPlayArea(sessionId, id));
        }
        return areas;
    }
}