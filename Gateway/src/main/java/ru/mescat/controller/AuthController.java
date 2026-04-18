package ru.mescat.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.mescat.security.dto.AuthResponse;
import ru.mescat.security.dto.LoginDto;
import ru.mescat.security.dto.RegDto;
import ru.mescat.security.exception.RemoteServiceException;
import ru.mescat.security.service.LoginService;
import ru.mescat.security.service.RefreshService;
import ru.mescat.security.service.RegisterService;
import ru.mescat.security.util.AuthCookieService;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/auth")
@Slf4j
public class AuthController {

    private final LoginService loginService;
    private final RegisterService registerService;
    private final RefreshService refreshService;
    private final AuthCookieService authCookieService;

    public AuthController(
            LoginService loginService,
            RegisterService registerService,
            RefreshService refreshService,
            AuthCookieService authCookieService
    ) {
        this.loginService = loginService;
        this.registerService = registerService;
        this.refreshService = refreshService;
        this.authCookieService = authCookieService;
    }

    @PostMapping("/login")
    public ResponseEntity<String> verify(
            @RequestBody LoginDto loginDto,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        log.info("Запрос на вход: username={}", loginDto.getUsername());
        try {
            AuthResponse tokens = loginService.login(loginDto);
            authCookieService.addAuthCookies(response, request, tokens);
            log.info("Вход выполнен: username={}", loginDto.getUsername());
            return ResponseEntity.ok("Успешный вход");
        } catch (BadCredentialsException e) {
            log.warn("Ошибка входа: неверные учетные данные, username={}", loginDto.getUsername());
            return ResponseEntity.status(401).body("Неверный логин или пароль");
        } catch (RemoteServiceException e) {
            log.warn("Ошибка входа: user-service ответил ошибкой, status={}, username={}",
                    e.getStatus(), loginDto.getUsername());
            return ResponseEntity.status(e.getStatus()).body(e.getResponseBody());
        } catch (Exception e) {
            log.error("Ошибка входа: username={}, error={}", loginDto.getUsername(), e.getMessage());
            return ResponseEntity.status(500).body("Ошибка сервера");
        }
    }

    @PostMapping("/reg")
    public ResponseEntity<String> registration(
            @RequestBody RegDto regDto,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        log.info("Запрос на регистрацию: username={}", regDto.getUsername());
        try {
            AuthResponse tokens = registerService.registration(regDto);
            authCookieService.addAuthCookies(response, request, tokens);
            log.info("Регистрация выполнена: username={}", regDto.getUsername());
            return ResponseEntity.ok("Регистрация успешна");
        } catch (RemoteServiceException e) {
            log.warn("Ошибка регистрации: user-service ответил ошибкой, status={}, username={}",
                    e.getStatus(), regDto.getUsername());
            return ResponseEntity.status(e.getStatus()).body(e.getResponseBody());
        } catch (Exception e) {
            log.error("Ошибка регистрации: username={}, error={}", regDto.getUsername(), e.getMessage());
            return ResponseEntity.status(500).body("Ошибка сервера");
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<String> refresh(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        log.info("Запрос на обновление токенов.");
        try {
            String refreshToken = authCookieService.extractCookieValue(request, "refresh_token");
            AuthResponse tokens = refreshService.refresh(refreshToken);
            authCookieService.addAuthCookies(response, request, tokens);
            log.info("Токены обновлены успешно.");
            return ResponseEntity.ok("Токены обновлены");
        } catch (BadCredentialsException | IllegalArgumentException e) {
            log.warn("Ошибка обновления токена: {}", e.getMessage());
            return ResponseEntity.status(401).body(e.getMessage());
        } catch (RemoteServiceException e) {
            log.warn("Ошибка обновления токена: downstream status={}", e.getStatus());
            return ResponseEntity.status(e.getStatus()).body(e.getResponseBody());
        } catch (Exception e) {
            log.error("Внутренняя ошибка при обновлении токена: {}", e.getMessage());
            return ResponseEntity.status(500).body("Ошибка сервера");
        }
    }

    @GetMapping("/refresh")
    public void refreshPageRequest(
            @RequestParam(value = "redirect", required = false, defaultValue = "/") String redirect,
            HttpServletRequest request,
            HttpServletResponse response
    ) throws IOException {
        try {
            String refreshToken = authCookieService.extractCookieValue(request, "refresh_token");
            AuthResponse tokens = refreshService.refresh(refreshToken);
            authCookieService.addAuthCookies(response, request, tokens);
            log.info("Обновление токенов через страницу выполнено успешно, redirect={}", redirect);
            response.sendRedirect(sanitizeRedirectTarget(redirect));
        } catch (Exception e) {
            log.warn("Обновление токенов через страницу не удалось, redirect={}, error={}", redirect, e.getMessage());
            authCookieService.clearAuthCookies(response, request);
            response.sendRedirect("/auth/login");
        }
    }

    private String sanitizeRedirectTarget(String redirect) {
        String decoded = URLDecoder.decode(redirect, StandardCharsets.UTF_8);

        if (decoded.isBlank()) {
            return "/";
        }

        if (!decoded.startsWith("/") || decoded.startsWith("//")) {
            return "/";
        }

        return decoded;
    }
}
