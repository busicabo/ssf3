package ru.mescat.client.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.mescat.client.dto.ChangePasswordDto;
import ru.mescat.client.dto.SettingsViewDto;
import ru.mescat.client.dto.UpdateAutoDeleteMessageDto;
import ru.mescat.client.dto.UpdateAvatarUrlDto;
import ru.mescat.client.dto.UpdateBooleanValueDto;
import ru.mescat.client.dto.UpdateUsernameDto;
import ru.mescat.security.User;
import ru.mescat.security.UserSettings;
import ru.mescat.security.exception.RemoteServiceException;
import ru.mescat.security.service.SecuritySettingsService;
import ru.mescat.security.service.UserService;

import java.util.UUID;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final UserService userService;
    private final SecuritySettingsService securitySettingsService;

    public SettingsController(UserService userService,
                              SecuritySettingsService securitySettingsService) {
        this.userService = userService;
        this.securitySettingsService = securitySettingsService;
    }

    @GetMapping
    public ResponseEntity<?> getSettings(Authentication authentication) {
        try {
            return ResponseEntity.ok(loadView(userId(authentication)));
        } catch (RemoteServiceException e) {
            return ResponseEntity.status(e.getStatus()).body(e.getResponseBody());
        }
    }

    @PatchMapping("/profile/username")
    public ResponseEntity<?> updateUsername(@RequestBody UpdateUsernameDto dto,
                                            Authentication authentication) {
        try {
            UUID userId = userId(authentication);
            userService.updateUsername(userId, dto != null ? dto.getUsername() : null);
            return ResponseEntity.ok(loadView(userId));
        } catch (RemoteServiceException e) {
            return ResponseEntity.status(e.getStatus()).body(e.getResponseBody());
        }
    }

    @PatchMapping("/profile/avatar-url")
    public ResponseEntity<?> updateAvatarUrl(@RequestBody UpdateAvatarUrlDto dto,
                                             Authentication authentication) {
        try {
            UUID userId = userId(authentication);
            userService.updateAvatarUrl(userId, dto != null ? dto.getAvatarUrl() : null);
            return ResponseEntity.ok(loadView(userId));
        } catch (RemoteServiceException e) {
            return ResponseEntity.status(e.getStatus()).body(e.getResponseBody());
        }
    }

    @PatchMapping("/preferences/allow-writing")
    public ResponseEntity<?> updateAllowWriting(@RequestBody UpdateBooleanValueDto dto,
                                                Authentication authentication) {
        try {
            UUID userId = userId(authentication);
            userService.updateAllowWriting(userId, dto != null && dto.isValue());
            return ResponseEntity.ok(loadView(userId));
        } catch (RemoteServiceException e) {
            return ResponseEntity.status(e.getStatus()).body(e.getResponseBody());
        }
    }

    @PatchMapping("/preferences/allow-add-chat")
    public ResponseEntity<?> updateAllowAddChat(@RequestBody UpdateBooleanValueDto dto,
                                                Authentication authentication) {
        try {
            UUID userId = userId(authentication);
            userService.updateAllowAddChat(userId, dto != null && dto.isValue());
            return ResponseEntity.ok(loadView(userId));
        } catch (RemoteServiceException e) {
            return ResponseEntity.status(e.getStatus()).body(e.getResponseBody());
        }
    }

    @PatchMapping("/preferences/auto-delete-message")
    public ResponseEntity<?> updateAutoDeleteMessage(@RequestBody UpdateAutoDeleteMessageDto dto,
                                                     Authentication authentication) {
        try {
            UUID userId = userId(authentication);
            userService.updateAutoDeleteMessage(userId, dto != null ? dto.getValue() : null);
            return ResponseEntity.ok(loadView(userId));
        } catch (RemoteServiceException e) {
            return ResponseEntity.status(e.getStatus()).body(e.getResponseBody());
        }
    }

    @PostMapping("/security/change-password")
    public ResponseEntity<?> changePassword(@RequestBody ChangePasswordDto dto,
                                            Authentication authentication,
                                            HttpServletRequest request,
                                            HttpServletResponse response) {
        try {
            securitySettingsService.changePassword(userId(authentication), dto, request, response);
            return ResponseEntity.ok("Пароль изменен. Выполнен выход из всех сессий.");
        } catch (RemoteServiceException e) {
            return ResponseEntity.status(e.getStatus()).body(e.getResponseBody());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/security/logout-all")
    public ResponseEntity<?> logoutAll(Authentication authentication,
                                       HttpServletRequest request,
                                       HttpServletResponse response) {
        securitySettingsService.logoutAll(userId(authentication), request, response);
        return ResponseEntity.ok("Все сессии завершены.");
    }

    private SettingsViewDto loadView(UUID userId) {
        User user = userService.infoById(userId);
        UserSettings settings = userService.settingsById(userId);
        return new SettingsViewDto(
                user != null ? user.getId() : userId,
                user != null ? user.getUsername() : null,
                user != null ? user.getAvatarUrl() : null,
                user != null ? user.getCreatedAt() : null,
                user != null && user.isOnline(),
                settings != null && settings.isAllowWriting(),
                settings != null && settings.isAllowAddChat(),
                settings != null ? settings.getAutoDeleteMessage() : null
        );
    }

    private UUID userId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
