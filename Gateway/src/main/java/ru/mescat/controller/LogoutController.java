package ru.mescat.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.mescat.security.service.BlackListTokens;
import ru.mescat.security.service.JwtService;
import ru.mescat.security.util.AuthCookieService;

@RestController
@RequestMapping("/auth")
@Slf4j
public class LogoutController {

    private final JwtService jwtService;
    private final BlackListTokens blackListTokens;
    private final AuthCookieService authCookieService;

    public LogoutController(JwtService jwtService, BlackListTokens blackListTokens, AuthCookieService authCookieService) {
        this.blackListTokens = blackListTokens;
        this.jwtService = jwtService;
        this.authCookieService = authCookieService;
    }

    @GetMapping("/logout")
    public ResponseEntity<String> logout(HttpServletRequest request, HttpServletResponse response) {
        log.info("Запрос на выход из системы.");

        authCookieService.resolveAnyToken(request).ifPresent(token -> {
            if (jwtService.isTokenSignatureValid(token)) {
                String userId = jwtService.extractUserId(token).toString();
                blackListTokens.blockTokenEarlierTime(userId);
                log.info("Пользователь вышел из системы: userId={}", userId);
            } else {
                log.warn("Запрос на выход: токен с невалидной подписью.");
            }
        });

        authCookieService.clearAuthCookies(response, request);
        return ResponseEntity.ok("Выход выполнен");
    }
}
