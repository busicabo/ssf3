package ru.mescat.message.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import ru.mescat.keyvault.dto.NewPrivateKeyDto;
import ru.mescat.keyvault.dto.NewPrivateKeyEntity;
import ru.mescat.keyvault.service.KeyVaultService;
import ru.mescat.message.event.dto.NewPrivateKey;

import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class NewPrivateKeyService {

    private KeyVaultService keyVaultService;
    private ApplicationEventPublisher applicationEventPublisher;

    public NewPrivateKeyService(KeyVaultService keyVaultService,
                                ApplicationEventPublisher applicationEventPublisher){
        this.applicationEventPublisher=applicationEventPublisher;
        this.keyVaultService=keyVaultService;
    }

    public NewPrivateKeyEntity findAllByUserId(UUID userId){
        NewPrivateKeyEntity key = keyVaultService.getPrivateKey(userId);
        log.info("Получен приватный ключ пользователя: userId={}", userId);
        return key;
    }

    public NewPrivateKeyEntity save(NewPrivateKeyDto newPrivateKeyDto){
        log.info("Запрос на сохранение приватного ключа: userId={}", newPrivateKeyDto.getUserId());
        NewPrivateKeyEntity newPrivateKeyEntity = keyVaultService.saveNewPrivateKey(newPrivateKeyDto);
        applicationEventPublisher.publishEvent(new NewPrivateKey(newPrivateKeyEntity));
        log.info("Приватный ключ сохранен: keyId={}, userId={}",
                newPrivateKeyEntity.getId(), newPrivateKeyEntity.getUserId());
        return newPrivateKeyEntity;
    }
}
