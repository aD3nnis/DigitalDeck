package com.ava.digitaldeck;

import com.ava.digitaldeck.model.DiscardMode;
import com.ava.digitaldeck.model.GameMode;
import com.ava.digitaldeck.model.PlayMode;
import com.ava.digitaldeck.services.SessionService;
import com.ava.digitaldeck.services.TurnActionPolicy;
import com.ava.digitaldeck.services.TurnService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

import static org.mockito.Mockito.lenient;


@ExtendWith(MockitoExtension.class)
class TurnActionPolicyTest {

    private static final String SESSION = "s1";
    private static final String CURRENT = "p-current";
    private static final String OTHER = "p-other";

    @Mock SessionService sessionService;
    @Mock TurnService turnService;

    TurnActionPolicy policy;

    @BeforeEach
    void setUp() {
        policy = new TurnActionPolicy(sessionService, turnService);
        lenient().when(turnService.getCurrentPlayer(SESSION)).thenReturn(Optional.of(CURRENT));
    }
    // --- Draw ----------------------------------------------------------------

    static Stream<Arguments> permitDrawCases() {
        return Stream.of(
            // gameMode, discardMode, actorIsCurrent, expectAllowed, expectAdvance, expectErrorOrNull
            Arguments.of(GameMode.TURN_ROTATION, DiscardMode.DISCARD_OFF, true,  true,  true,  null),
            Arguments.of(GameMode.TURN_ROTATION, DiscardMode.DISCARD_OFF, false, false, false, "not your turn"),
            Arguments.of(GameMode.TURN_ROTATION, DiscardMode.TURN_DISCARD, true,  true,  false, null),
            Arguments.of(GameMode.TURN_ROTATION, DiscardMode.TURN_DISCARD, false, false, false, "not your turn"),
            Arguments.of(GameMode.TURN_ROTATION, DiscardMode.FREE_DISCARD, true,  true,  true,  null),
            Arguments.of(GameMode.TURN_ROTATION, DiscardMode.FREE_DISCARD, false, false, false, "not your turn"),

            Arguments.of(GameMode.FREE_ROTATION, DiscardMode.DISCARD_OFF, true,  true, false, null),
            Arguments.of(GameMode.FREE_ROTATION, DiscardMode.DISCARD_OFF, false, true, false, null),
            // unexpected lobby combo — still exercises policy
            Arguments.of(GameMode.FREE_ROTATION, DiscardMode.TURN_DISCARD, true,  true, false, null),
            Arguments.of(GameMode.FREE_ROTATION, DiscardMode.TURN_DISCARD, false, true, false, null),
            Arguments.of(GameMode.FREE_ROTATION, DiscardMode.FREE_DISCARD, true,  true, false, null),
            Arguments.of(GameMode.FREE_ROTATION, DiscardMode.FREE_DISCARD, false, true, false, null)
        );
    }

    @ParameterizedTest(name = "draw {0} discard={1} current={2} → allowed={3} advance={4}")
    @MethodSource("permitDrawCases")
    void permitDraw(
            GameMode gameMode,
            DiscardMode discardMode,
            boolean actorIsCurrent,
            boolean expectAllowed,
            boolean expectAdvance,
            String expectError) {

        when(sessionService.getGameMode(SESSION)).thenReturn(gameMode);
        when(sessionService.getDiscardMode(SESSION)).thenReturn(discardMode);

        String actor = actorIsCurrent ? CURRENT : OTHER;
        TurnActionPolicy.Permit permit = policy.permitDraw(SESSION, actor);
        assertPermit(permit, expectAllowed, expectAdvance, expectError);
    }

    // --- Discard -------------------------------------------------------------

    static Stream<Arguments> permitDiscardCases() {
        return Stream.of(
            // discardMode, gameMode, actorIsCurrent, expectAllowed, expectAdvance, expectErrorOrNull
            Arguments.of(DiscardMode.DISCARD_OFF, GameMode.TURN_ROTATION, true,  false, false, "discard is disabled"),
            Arguments.of(DiscardMode.DISCARD_OFF, GameMode.TURN_ROTATION, false, false, false, "discard is disabled"),
            Arguments.of(DiscardMode.DISCARD_OFF, GameMode.FREE_ROTATION, true,  false, false, "discard is disabled"),
            Arguments.of(DiscardMode.DISCARD_OFF, GameMode.FREE_ROTATION, false, false, false, "discard is disabled"),

            Arguments.of(DiscardMode.TURN_DISCARD, GameMode.TURN_ROTATION, true,  true,  true,  null),
            Arguments.of(DiscardMode.TURN_DISCARD, GameMode.TURN_ROTATION, false, false, false, "not your turn"),
            // unexpected: free rotation + turn discard
            Arguments.of(DiscardMode.TURN_DISCARD, GameMode.FREE_ROTATION, true,  true,  false, null),
            Arguments.of(DiscardMode.TURN_DISCARD, GameMode.FREE_ROTATION, false, false, false, "not your turn"),

            Arguments.of(DiscardMode.FREE_DISCARD, GameMode.TURN_ROTATION, true,  true, false, null),
            Arguments.of(DiscardMode.FREE_DISCARD, GameMode.TURN_ROTATION, false, true, false, null),
            Arguments.of(DiscardMode.FREE_DISCARD, GameMode.FREE_ROTATION, true,  true, false, null),
            Arguments.of(DiscardMode.FREE_DISCARD, GameMode.FREE_ROTATION, false, true, false, null)
        );
    }

    @ParameterizedTest(name = "discard {0} game={1} current={2} → allowed={3} advance={4}")
    @MethodSource("permitDiscardCases")
    void permitDiscard(
            DiscardMode discardMode,
            GameMode gameMode,
            boolean actorIsCurrent,
            boolean expectAllowed,
            boolean expectAdvance,
            String expectError) {

        when(sessionService.getDiscardMode(SESSION)).thenReturn(discardMode);
        // getGameMode only consulted when discard is allowed
        if (expectAllowed) {
            when(sessionService.getGameMode(SESSION)).thenReturn(gameMode);
        } else if (discardMode == DiscardMode.TURN_DISCARD && !actorIsCurrent) {
            // denied before gameMode read — no stub needed
        } else if (discardMode == DiscardMode.DISCARD_OFF) {
            // denied before gameMode read
        } else {
            when(sessionService.getGameMode(SESSION)).thenReturn(gameMode);
        }

        String actor = actorIsCurrent ? CURRENT : OTHER;
        TurnActionPolicy.Permit permit = policy.permitDiscard(SESSION, actor);
        assertPermit(permit, expectAllowed, expectAdvance, expectError);
    }

    // --- Play ----------------------------------------------------------------

    static Stream<Arguments> permitPlayCases() {
        return Stream.of(
            // playMode, actorIsCurrent, expectAllowed, expectErrorOrNull
            Arguments.of(PlayMode.PLAY_OFF, true,  false, "play is disabled"),
            Arguments.of(PlayMode.PLAY_OFF, false, false, "play is disabled"),
            Arguments.of(PlayMode.TURN_PLAY, true,  true,  null),
            Arguments.of(PlayMode.TURN_PLAY, false, false, "not your turn"),
            Arguments.of(PlayMode.FREE_PLAY, true,  true,  null),
            Arguments.of(PlayMode.FREE_PLAY, false, true,  null)
        );
    }

    @ParameterizedTest(name = "play {0} current={1} → allowed={2}")
    @MethodSource("permitPlayCases")
    void permitPlay(
            PlayMode playMode,
            boolean actorIsCurrent,
            boolean expectAllowed,
            String expectError) {

        when(sessionService.getPlayMode(SESSION)).thenReturn(playMode);

        String actor = actorIsCurrent ? CURRENT : OTHER;
        TurnActionPolicy.Permit permit = policy.permitPlay(SESSION, actor);
        // play never advances
        assertPermit(permit, expectAllowed, false, expectError);
    }

    private static void assertPermit(
            TurnActionPolicy.Permit permit,
            boolean expectAllowed,
            boolean expectAdvance,
            String expectError) {

        if (!expectAllowed) {
            assertInstanceOf(TurnActionPolicy.Permit.Denied.class, permit);
            assertEquals(expectError, ((TurnActionPolicy.Permit.Denied) permit).error());
            return;
        }
        assertInstanceOf(TurnActionPolicy.Permit.Allowed.class, permit);
        assertEquals(expectAdvance, ((TurnActionPolicy.Permit.Allowed) permit).advanceTurnAfter());
    }
}