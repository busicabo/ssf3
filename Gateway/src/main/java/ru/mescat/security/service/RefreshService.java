package ru.mescat.security.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ru.mescat.security.User;
import ru.mescat.security.dto.AuthResponse;

import java.util.UUID;

@Service
@Slf4j
public class RefreshService {

    private final JwtService jwtService;
    private final UserService userService;
    private final BlackListTokens blackListTokens;

    public RefreshService(JwtService jwtService, UserService userService, BlackListTokens blackListTokens) {
        this.blackListTokens = blackListTokens;
        this.jwtService = jwtService;
        this.userService = userService;
    }

    public AuthResponse refresh(String refreshToken) {
        log.info("Запрошено обновление токенов.");

        if (refreshToken == null || refreshToken.isBlank()) {
            log.warn("Обновление токенов отклонено: refresh token отсутствует.");
            throw new IllegalArgumentException("Refresh token отсутствует");
        }

        if (!jwtService.isTokenSignatureValid(refreshToken)) {
            log.warn("Обновление токенов отклонено: невалидная подпись refresh token.");
            throw new IllegalArgumentException("Невалидный refresh token");
        }

        if (!jwtService.isRefreshToken(refreshToken)) {
            log.warn("Обновление токенов отклонено: передан не refresh token.");
            throw new IllegalArgumentException("Это не refresh token");
        }

        if (jwtService.isTokenExpired(refreshToken)) {
            log.warn("Обновление токенов отклонено: refresh token истек.");
            throw new IllegalArgumentException("Refresh token истек");
        }

        if (!blackListTokens.isValid(refreshToken)) {
            log.warn("Обновление токенов отклонено: refresh token отозван.");
            throw new IllegalArgumentException("Refresh token отозван");
        }

        UUID userId = jwtService.extractUserId(refreshToken);
        User user = userService.infoById(userId);

        if (user == null || user.isBlocked()) {
            log.warn("Обновление токенов отклонено: пользователь недоступен или заблокирован. userId={}", userId);
            throw new IllegalArgumentException("Пользователь недоступен");
        }

        blackListTokens.initIfAbsent(user.getId().toString());

        String newAccessToken = jwtService.generateAccessToken(user.getId());
        String newRefreshToken = jwtService.generateRefreshToken(user.getId());

        log.info("Токены успешно обновлены: userId={}", userId);
        return new AuthResponse(newAccessToken, newRefreshToken);
    }
}
