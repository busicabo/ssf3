package ru.mescat.security.service;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;
import ru.mescat.client.dto.ChangePasswordDto;
import ru.mescat.security.User;
import ru.mescat.security.util.AuthCookieService;

import java.util.UUID;

@Service
@Slf4j
public class SecuritySettingsService {

    private final AuthenticationManager authenticationManager;
    private final UserService userService;
    private final BlackListTokens blackListTokens;
    private final AuthCookieService authCookieService;

    public SecuritySettingsService(AuthenticationManager authenticationManager,
                                   UserService userService,
                                   BlackListTokens blackListTokens,
                                   AuthCookieService authCookieService) {
        this.authenticationManager = authenticationManager;
        this.userService = userService;
        this.blackListTokens = blackListTokens;
        this.authCookieService = authCookieService;
    }

    public void changePassword(UUID userId,
                               ChangePasswordDto dto,
                               HttpServletRequest request,
                               HttpServletResponse response) {
        if (dto == null) {
            throw new IllegalArgumentException("Тело запроса не должно быть пустым.");
        }

        String currentPassword = safeTrim(dto.getCurrentPassword());
        String newPassword = safeTrim(dto.getNewPassword());
        String confirmPassword = safeTrim(dto.getConfirmPassword());

        if (currentPassword.isBlank() || newPassword.isBlank() || confirmPassword.isBlank()) {
            throw new IllegalArgumentException("Все поля пароля обязательны.");
        }
        if (!newPassword.equals(confirmPassword)) {
            throw new IllegalArgumentException("Новый пароль и подтверждение не совпадают.");
        }
        if (newPassword.length() < 8 || newPassword.length() > 200) {
            throw new IllegalArgumentException("Новый пароль должен содержать от 8 до 200 символов.");
        }

        User user = userService.infoById(userId);
        if (user == null) {
            throw new IllegalArgumentException("Пользователь не найден.");
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(user.getUsername(), currentPassword)
            );
        } catch (BadCredentialsException e) {
            throw new IllegalArgumentException("Текущий пароль неверный.");
        }

        userService.updatePassword(userId, newPassword);
        blackListTokens.blockTokenEarlierTime(userId.toString());
        authCookieService.clearAuthCookies(response, request);
        log.info("Пароль изменен и все сессии завершены: userId={}", userId);
    }

    public void logoutAll(UUID userId,
                          HttpServletRequest request,
                          HttpServletResponse response) {
        blackListTokens.blockTokenEarlierTime(userId.toString());
        authCookieService.clearAuthCookies(response, request);
        log.info("Завершены все сессии пользователя: userId={}", userId);
    }

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }
}
