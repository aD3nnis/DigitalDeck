package com.ava.digitaldeck;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@CrossOrigin(origins = "http://localhost:3000")
public class RedisTestController {

    private final StringRedisTemplate redisTemplate;

    @Autowired
    public RedisTestController(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @GetMapping("/api/redis-test")
    public Map<String, String> redisTest() {
        redisTemplate.opsForValue().set("test-key", "hello from spring boot");
        String value = redisTemplate.opsForValue().get("test-key");
        return Map.of("value", value);
    }
}