package ru.mescat.security.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ru.mescat.security.User;
import ru.mescat.security.dto.AuthResponse;
import ru.mescat.security.dto.RegDto;

@Service
@Slf4j
public class RegisterService {

    private final JwtService jwtService;
    private final UserService userService;
    private final BlackListTokens blackListTokens;

    public RegisterService(JwtService jwtService, UserService userService, BlackListTokens blackListTokens) {
        this.blackListTokens = blackListTokens;
        this.userService = userService;
        this.jwtService = jwtService;
    }

    public AuthResponse registration(RegDto regDto) {
        log.info("Регистрация нового пользователя: username={}", regDto.getUsername());
        User user = userService.registration(regDto);

        blackListTokens.initIfAbsent(user.getId().toString());

        String accessToken = jwtService.generateAccessToken(user.getId());
        String refreshToken = jwtService.generateRefreshToken(user.getId());

        log.info("Пользователь зарегистрирован: userId={}, username={}", user.getId(), user.getUsername());
        return new AuthResponse(accessToken, refreshToken);
    }
}
