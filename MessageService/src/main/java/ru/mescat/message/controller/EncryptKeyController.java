package ru.mescat.message.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.mescat.keyvault.dto.NewPrivateKeyDto;
import ru.mescat.keyvault.dto.NewPrivateKeyEntity;
import ru.mescat.keyvault.dto.PublicKey;
import ru.mescat.keyvault.service.KeyVaultService;
import ru.mescat.message.exception.MaxActiveKeysLimitExceededException;
import ru.mescat.message.exception.NotFoundException;
import ru.mescat.message.exception.RemoteServiceException;
import ru.mescat.message.exception.SaveToDatabaseException;
import ru.mescat.message.exception.ValidationException;
import ru.mescat.message.service.CreateKeyVault;
import ru.mescat.message.service.NewPrivateKeyService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/encrypt_key")
public class EncryptKeyController {

    private final KeyVaultService keyVaultService;
    private final CreateKeyVault createKeyVault;
    private final NewPrivateKeyService newPrivateKeyService;

    public EncryptKeyController(KeyVaultService keyVaultService,
                                CreateKeyVault createKeyVault,
                                NewPrivateKeyService newPrivateKeyService) {
        this.newPrivateKeyService = newPrivateKeyService;
        this.createKeyVault = createKeyVault;
        this.keyVaultService = keyVaultService;
    }

    //РЎРѕР·РґР°РЅРёРµ РїСѓР±Р»РёС‡РЅРѕРіРѕ РєР»СЋС‡Р°
    @PostMapping("/new_key")
    public ResponseEntity<?> addNewKey(@RequestHeader("X-User-Id") UUID userId,
                                       @RequestBody byte[] publicKey) {
        try {
            createKeyVault.addNewKey(userId, publicKey);
            return ResponseEntity.ok("РљР»СЋС‡ СѓСЃРїРµС€РЅРѕ СЃРѕР·РґР°РЅ.");
        } catch (ValidationException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (NotFoundException e) {
            return ResponseEntity.status(404).body(e.getMessage());
        } catch (MaxActiveKeysLimitExceededException e) {
            return ResponseEntity.status(409).body(e.getMessage());
        } catch (SaveToDatabaseException e) {
            return ResponseEntity.status(500).body(e.getMessage());
        }
    }

    //РџРѕР»СѓС‡РµРЅРёРµ РїСѓР±Р»РёС‡РЅС‹С… РєР»СЋС‡РµР№ РєР°Р¶РґРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РёР· СЃРїРёСЃРєР°.
    @PostMapping("/byUserIdIn")
    public ResponseEntity<?> getAllKeys(@RequestBody List<UUID> uuids) {
        try {
            if (uuids == null || uuids.isEmpty()) {
                return ResponseEntity.badRequest().body("РЎРїРёСЃРѕРє РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂРѕРІ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ РЅРµ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РїСѓСЃС‚С‹Рј.");
            }

            List<PublicKey> keys = keyVaultService.getKeysByUserIdIn(uuids);
            if (keys == null || keys.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            return ResponseEntity.ok(keys);
        } catch (RemoteServiceException e) {
            return ResponseEntity.status(e.getStatus()).body(e.getResponseBody());
        }
    }

    @PostMapping("/byIds")
    public ResponseEntity<?> getAllKeysByIds(@RequestBody List<UUID> ids) {
        try {
            if (ids == null || ids.isEmpty()) {
                return ResponseEntity.badRequest().body("РЎРїРёСЃРѕРє РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂРѕРІ РєР»СЋС‡РµР№ РЅРµ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РїСѓСЃС‚С‹Рј.");
            }

            List<PublicKey> keys = keyVaultService.getKeysByIdIn(ids);
            if (keys == null || keys.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            return ResponseEntity.ok(keys);
        } catch (RemoteServiceException e) {
            return ResponseEntity.status(e.getStatus()).body(e.getResponseBody());
        }
    }


    //РџРѕР»СѓС‡РёС‚СЊ РїСѓР±Р»РёС‡РЅС‹Р№ РєР»СЋС‡ РїРѕ Р°Р№РґРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
    @GetMapping("/")
    public ResponseEntity<?> getKey(@RequestHeader("X-User-Id") UUID userId) {
        try {
            PublicKey key = keyVaultService.getKeyByUserId(userId.toString());

            if (key == null) {
                return ResponseEntity.notFound().build();
            }

            return ResponseEntity.ok(key);
        } catch (RemoteServiceException e) {
            return ResponseEntity.status(e.getStatus()).body(e.getResponseBody());
        }
    }

    //РџСЂРё СЃРѕР·РґР°РЅРёРµ РЅРѕРІРѕР№ СЃРµСЃСЃРёРё СЃРѕР·РґР°РµС‚СЃСЏ РЅРѕРІС‹Р№ РїСЂРёРІР°С‚РЅС‹Р№ РєР»СЋС‡, Р° СЃС‚Р°СЂС‹Рј РєР»СЋС‡РµРј С€РёС„СЂСѓРµС‚СЊСЃСЏ РЅРѕРІС‹Р№ РєР»СЋС‡ Рё СЂР°СЃСЃС‹Р»Р°РµС‚СЊСЃСЏ РІСЃРµРј

    //РџРѕР»СѓС‡РёС‚СЊ РІСЃРµ РїСЂРёРІР°С‚РЅС‹Рµ РєР»СЋС‡Рё
    @GetMapping("/new_private_key")
    public ResponseEntity<?> getNewPrivateKeyEntities(@RequestHeader("X-User-Id") UUID userId) {
        try {
            NewPrivateKeyEntity result = newPrivateKeyService.findAllByUserId(userId);
            if (result == null) {
                return ResponseEntity.noContent().build();
            }

            return ResponseEntity.ok(result);
        } catch (RemoteServiceException e) {
            if (e.getStatus() == 404) {
                return ResponseEntity.noContent().build();
            }
            return ResponseEntity.status(e.getStatus()).body(e.getResponseBody());
        }
    }

    //РЎРѕС…СЂР°РЅРµРЅРёРµ РЅРѕРІРѕРіРѕ РїСЂРёРІР°С‚РЅРѕРіРѕ РєР»СЋС‡Р°
    @PostMapping("/new_private_key")
    public ResponseEntity<?> saveNewPrivateKeyEntities(@RequestHeader("X-User-Id") UUID userId,
                                                       @RequestBody NewPrivateKeyDto newPrivateKeyDto) {
        if (newPrivateKeyDto == null) {
            return ResponseEntity.badRequest().body("РўРµР»Рѕ Р·Р°РїСЂРѕСЃР° РЅРµ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ РїСѓСЃС‚С‹Рј.");
        }
        if (newPrivateKeyDto.getUserId() == null || !newPrivateKeyDto.getUserId().equals(userId)) {
            return ResponseEntity.badRequest().body("РРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РЅРµ СЃРѕРІРїР°РґР°РµС‚ СЃ Р°РІС‚РѕСЂРёР·РѕРІР°РЅРЅС‹Рј РїРѕР»СЊР·РѕРІР°С‚РµР»РµРј.");
        }
        if (newPrivateKeyDto.getKey() == null || newPrivateKeyDto.getKey().length == 0) {
            return ResponseEntity.badRequest().body("РџСЂРёРІР°С‚РЅС‹Р№ РєР»СЋС‡ РЅРµ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РїСѓСЃС‚С‹Рј.");
        }
        if (newPrivateKeyDto.getPublicKey() == null) {
            return ResponseEntity.badRequest().body("РџСѓР±Р»РёС‡РЅС‹Р№ РєР»СЋС‡ РЅРµ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РїСѓСЃС‚С‹Рј.");
        }
        if (newPrivateKeyDto.getEncryptingPublicKey() == null) {
            return ResponseEntity.badRequest().body("Публичный ключ, которым зашифрован приватный ключ, не должен быть пустым.");
        }

        try {
            Object saved = newPrivateKeyService.save(newPrivateKeyDto);
            if (saved == null) {
                return ResponseEntity.status(500).body("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РїСЂРёРІР°С‚РЅС‹Р№ РєР»СЋС‡.");
            }

            return ResponseEntity.ok(saved);
        } catch (RemoteServiceException e) {
            return ResponseEntity.status(e.getStatus()).body(e.getResponseBody());
        }
    }
}
