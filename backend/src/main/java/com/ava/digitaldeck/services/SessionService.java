package com.ava.digitaldeck.services;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

@Service
public class SessionService {

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
    private static final int CODE_LENGTH = 5;
    private static final Duration SESSION_TTL = Duration.ofHours(4);

    private final StringRedisTemplate redisTemplate;
    private final SecureRandom random = new SecureRandom();

    @Autowired
    public SessionService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public String createSession() {
        String sessionId = UUID.randomUUID().toString();
        String code = generateUniqueCode();

        redisTemplate.opsForValue().set("code:" + code, sessionId, SESSION_TTL);
        redisTemplate.opsForValue().set("session:" + sessionId + ":meta", "active", SESSION_TTL);

        return code;
    }

    public Optional<String> resolveCode(String code) {
        String sessionId = redisTemplate.opsForValue().get("code:" + code.trim().toUpperCase());
        return Optional.ofNullable(sessionId);
    }

    private String generateUniqueCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                sb.append(CODE_CHARS.charAt(random.nextInt(CODE_CHARS.length())));
            }
            code = sb.toString();
        } while (redisTemplate.hasKey("code:" + code));
        return code;
    }
}