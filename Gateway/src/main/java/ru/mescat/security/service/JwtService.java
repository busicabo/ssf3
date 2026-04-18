package ru.mescat.security.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {

    private final SecretKey key;
    private final long accessTokenExpiration;
    private final long refreshTokenExpiration;

    public JwtService(
            @Value("${app.security.jwt.secret}") String secret,
            @Value("${app.security.jwt.access-token-expiration}") long accessTokenExpiration,
            @Value("${app.security.jwt.refresh-token-expiration}") long refreshTokenExpiration
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenExpiration = accessTokenExpiration;
        this.refreshTokenExpiration = refreshTokenExpiration;
    }

    public String generateAccessToken(UUID userId) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(userId.toString())
                .claim("type", "access")
                .claim("iat_ms", now)
                .issuedAt(new Date(now))
                .expiration(new Date(now + accessTokenExpiration))
                .signWith(key)
                .compact();
    }

    public String generateRefreshToken(UUID userId) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(userId.toString())
                .claim("type", "refresh")
                .claim("iat_ms", now)
                .issuedAt(new Date(now))
                .expiration(new Date(now + refreshTokenExpiration))
                .signWith(key)
                .compact();
    }

    public UUID extractUserId(String token) {
        return UUID.fromString(extractAllClaims(token).getSubject());
    }

    public String extractType(String token) {
        return extractAllClaims(token).get("type", String.class);
    }

    public Date extractExpiration(String token) {
        return extractAllClaims(token).getExpiration();
    }

    public boolean isAccessToken(String token) {
        return "access".equals(extractType(token));
    }

    public boolean isRefreshToken(String token) {
        return "refresh".equals(extractType(token));
    }

    public boolean isTokenValid(String token, UUID userId) {
        UUID extractedUserId = extractUserId(token);
        return extractedUserId.equals(userId) && !isTokenExpired(token);
    }

    public boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    public Claims extractAllClaims(String token) {
        JwtParser parser = Jwts.parser()
                .verifyWith(key)
                .build();

        return parser.parseSignedClaims(token)
                .getPayload();
    }

    public boolean isTokenSignatureValid(String token) {
        try {
            extractAllClaims(token);
            return true;
        } catch (ExpiredJwtException e) {
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}
