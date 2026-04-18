package ru.mescat.security.service;

import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class BlackListTokens {

    private static final String PREFIX = "token_block_time:";
    private final StringRedisTemplate stringRedisTemplate;
    private final JwtService jwtService;

    public void initIfAbsent(String userId) {
        String key = PREFIX + userId;
        if (Boolean.FALSE.equals(stringRedisTemplate.hasKey(key))) {
            stringRedisTemplate.opsForValue().set(key, "0");
        }
    }

    public void blockTokenEarlierTime(String userId) {
        String key = PREFIX + userId;
        stringRedisTemplate.opsForValue().set(key, String.valueOf(System.currentTimeMillis()));
    }

    public boolean isValid(String token) {
        Claims claims = jwtService.extractAllClaims(token);
        String userId = claims.getSubject();

        String blockTimeString = stringRedisTemplate.opsForValue().get(PREFIX + userId);

        if (blockTimeString == null) {
            return false;
        }

        long blockTimeMillis = Long.parseLong(blockTimeString);

        Long tokenIatMillis = claims.get("iat_ms", Long.class);
        if (tokenIatMillis == null && claims.getIssuedAt() != null) {
            tokenIatMillis = claims.getIssuedAt().toInstant().toEpochMilli();
        }
        if (tokenIatMillis == null) {
            return false;
        }

        return tokenIatMillis >= blockTimeMillis;
    }
}
