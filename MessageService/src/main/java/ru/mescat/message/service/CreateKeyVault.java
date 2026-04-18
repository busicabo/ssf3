package ru.mescat.message.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import ru.mescat.keyvault.dto.PublicKey;
import ru.mescat.keyvault.dto.SaveDto;
import ru.mescat.keyvault.service.KeyVaultService;
import ru.mescat.message.event.dto.NewPublicKey;
import ru.mescat.message.exception.SaveToDatabaseException;
import ru.mescat.message.exception.ValidationException;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

@Service
@Slf4j
public class CreateKeyVault {

    private static final int MAX_PUBLIC_KEY_SIZE = 8192;

    private final KeyVaultService keyVaultService;
    private final ApplicationEventPublisher applicationEventPublisher;

    public CreateKeyVault(KeyVaultService keyVaultService,
                          ApplicationEventPublisher applicationEventPublisher) {
        this.keyVaultService = keyVaultService;
        this.applicationEventPublisher = applicationEventPublisher;
    }

    public boolean addNewKey(UUID userId, byte[] publicKey) {
        log.info("Запрос на сохранение публичного ключа: userId={}", userId);

        if (publicKey == null || publicKey.length == 0) {
            throw new ValidationException("Публичный ключ не должен быть пустым.");
        }

        byte[] normalizedKey = normalizeIncomingPublicKey(publicKey);
        if (normalizedKey.length > MAX_PUBLIC_KEY_SIZE) {
            throw new ValidationException("Размер публичного ключа превышает допустимый предел.");
        }

        PublicKey pk = keyVaultService.saveKey(new SaveDto(userId, normalizedKey));
        if (pk == null || pk.getId() == null) {
            log.error("Не удалось сохранить публичный ключ: userId={}", userId);
            throw new SaveToDatabaseException("Не удалось сохранить новый ключ.");
        }

        applicationEventPublisher.publishEvent(new NewPublicKey(pk));
        log.info("Публичный ключ сохранен: keyId={}, userId={}", pk.getId(), userId);

        return true;
    }

    private byte[] normalizeIncomingPublicKey(byte[] raw) {
        try {
            String candidate = new String(raw, StandardCharsets.UTF_8).trim();

            if (candidate.startsWith("\"") && candidate.endsWith("\"") && candidate.length() >= 2) {
                candidate = candidate.substring(1, candidate.length() - 1);
            }

            if (!candidate.isBlank() && looksLikeBase64(candidate)) {
                byte[] decoded = Base64.getDecoder().decode(candidate);
                if (decoded.length > 0) {
                    return decoded;
                }
            }
        } catch (Exception ignored) {
            // Если это не текст base64, считаем, что ключ уже бинарный.
        }

        return raw;
    }

    private boolean looksLikeBase64(String value) {
        if (value.length() < 16 || (value.length() % 4) != 0) {
            return false;
        }

        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            boolean ok =
                    (c >= 'A' && c <= 'Z') ||
                    (c >= 'a' && c <= 'z') ||
                    (c >= '0' && c <= '9') ||
                    c == '+' || c == '/' || c == '=';
            if (!ok) {
                return false;
            }
        }

        return true;
    }
}
