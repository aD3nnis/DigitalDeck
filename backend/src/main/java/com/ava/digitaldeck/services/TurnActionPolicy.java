package com.ava.digitaldeck.services;

import com.ava.digitaldeck.model.DiscardMode;
import com.ava.digitaldeck.model.GameMode;
import com.ava.digitaldeck.model.PlayMode;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class TurnActionPolicy {

    public sealed interface Permit {
        record Allowed(boolean advanceTurnAfter) implements Permit {}
        record Denied(String error) implements Permit {}
    }

    private final SessionService sessionService;
    private final TurnService turnService;

    public TurnActionPolicy(SessionService sessionService, TurnService turnService) {
        this.sessionService = sessionService;
        this.turnService = turnService;
    }

    /** May this player draw? Also answers whether draw should advance the turn. */
    public Permit permitDraw(String sessionId, String playerId) {
        GameMode mode = sessionService.getGameMode(sessionId);
        DiscardMode discardMode = sessionService.getDiscardMode(sessionId);

        if (mode == GameMode.TURN_ROTATION && !isCurrentPlayer(sessionId, playerId)) {
            return new Permit.Denied("not your turn");
        }

        boolean advance =
                mode == GameMode.TURN_ROTATION
                        && discardMode != DiscardMode.TURN_DISCARD;

        return new Permit.Allowed(advance);
    }

    /** May this player discard? Also answers whether discard should advance the turn. */
    public Permit permitDiscard(String sessionId, String playerId) {
        DiscardMode discardMode = sessionService.getDiscardMode(sessionId);
        if (discardMode == DiscardMode.DISCARD_OFF) {
            return new Permit.Denied("discard is disabled");
        }

        if (discardMode == DiscardMode.TURN_DISCARD
                && !isCurrentPlayer(sessionId, playerId)) {
            return new Permit.Denied("not your turn");
        }

        GameMode mode = sessionService.getGameMode(sessionId);
        boolean advance =
                mode == GameMode.TURN_ROTATION
                        && discardMode == DiscardMode.TURN_DISCARD;

        return new Permit.Allowed(advance);
    }
    /** Play never advances the turn. */
    public Permit permitPlay(String sessionId, String playerId) {
        PlayMode playMode = sessionService.getPlayMode(sessionId);
        if (playMode == PlayMode.PLAY_OFF) {
            return new Permit.Denied("play is disabled");
        }
        if (playMode == PlayMode.TURN_PLAY && !isCurrentPlayer(sessionId, playerId)) {
            return new Permit.Denied("not your turn");
        }
        return new Permit.Allowed(false);
    }

    /** Keep pending draw in hand and end turn. Only when pending exists. */
    public Permit permitKeep(String sessionId, String playerId) {
        GameMode mode = sessionService.getGameMode(sessionId);
        DiscardMode discardMode = sessionService.getDiscardMode(sessionId);

        if (mode != GameMode.TURN_ROTATION || discardMode != DiscardMode.TURN_DISCARD) {
            return new Permit.Denied("keep is not available in this mode");
        }
        if (!isCurrentPlayer(sessionId, playerId)) {
            return new Permit.Denied("not your turn");
        }
        if (turnService.getPendingDrawn(sessionId, playerId).isEmpty()) {
            return new Permit.Denied("no pending draw to keep");
        }
        return new Permit.Allowed(true); // always advances
    }

    private boolean isCurrentPlayer(String sessionId, String playerId) {
        Optional<String> current = turnService.getCurrentPlayer(sessionId);
        return current.isPresent() && current.get().equals(playerId);
    }
}