package ru.mescat.message.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;
import ru.mescat.keyvault.dto.PublicKey;
import ru.mescat.keyvault.dto.SaveDto;
import ru.mescat.keyvault.service.KeyVaultService;
import ru.mescat.message.dto.ApiResponse;
import ru.mescat.message.exception.MaxActiveKeysLimitExceededException;
import ru.mescat.message.exception.NotFoundException;
import ru.mescat.message.exception.SaveToDatabaseException;
import ru.mescat.message.exception.ValidationException;
import ru.mescat.message.websocket.WebSocketService;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class CreateKeyVault {

    private KeyVaultService keyVaultService;
    private Integer maxActiveKey;
    private WebSocketService webSocketService;

    public CreateKeyVault(KeyVaultService keyVaultService,
                          @Value("${app.max-active-key}")Integer maxActiveKey,
                          WebSocketService webSocketService){
        this.webSocketService=webSocketService;
        this.maxActiveKey=maxActiveKey;
        this.keyVaultService=keyVaultService;
    }

    public boolean addNewKey(@RequestBody byte[] publicKey, Authentication authentication){
        Integer countAccounts = keyVaultService.getActiveCountPublicKey(authentication.getName());
        if(countAccounts==null){
            throw new NotFoundException("Не смогли получить существующие ключи");
        }

        if(countAccounts>=maxActiveKey){
            throw new MaxActiveKeysLimitExceededException("Максимальное число активных сессий. Ограничьте доступ других ключей.");
        }
        UUID userId = UUID.fromString(authentication.getName());

        PublicKey pk = keyVaultService.saveKey(new SaveDto(userId,publicKey));
        if(pk==null){
            throw new SaveToDatabaseException("Не удалось создать новый ключ.");
        }

        webSocketService.sendNotification(new ApiResponse(0,"Успешное создания ключа! Можете начинать общение."
                ,true, OffsetDateTime.now()),userId);

        return true;
    }
}
