package ru.mescat.message.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.mescat.message.dto.SendEncryptKeyDto;
import ru.mescat.message.dto.kafka.KeyDelete;
import ru.mescat.message.exception.ChatNotFoundException;
import ru.mescat.message.exception.SaveToDatabaseException;
import ru.mescat.message.exception.UserBlockedException;
import ru.mescat.message.service.DeleteSentKeysService;
import ru.mescat.message.service.SendMessageKeyService;

import java.util.List;
import java.util.UUID;

//РљРѕРЅС‚СЂРѕР»Р»РµСЂ РѕС‚РІРµС‡Р°СЋС‰РёР№ Р·Р° РєР»СЋС‡Рё С€РёС„СЂРѕРІР°РЅРёСЏ СЃРѕРѕР±С‰РµРЅРёР№.

@RestController
@RequestMapping("/api/encrypt_message_key")
public class EncryptMessageKeyController {

    private final DeleteSentKeysService deleteSentKeysService;
    private final SendMessageKeyService sendMessageKeyService;

    public EncryptMessageKeyController(DeleteSentKeysService deleteSentKeysService,
                                       SendMessageKeyService sendMessageKeyService) {
        this.sendMessageKeyService = sendMessageKeyService;
        this.deleteSentKeysService = deleteSentKeysService;
    }

    //РЈРґР°Р»РёС‚СЊ РєР»СЋС‡ РµСЃР»Рё РїСЂРѕС‡РёС‚Р°Р»
    @PostMapping("/delete")
    public ResponseEntity<?> deleteMessageKey(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestBody KeyDelete keyDelete) {
        try {
            deleteSentKeysService.addKeyInQueue(keyDelete,userId);
            return ResponseEntity.ok("РљР»СЋС‡Рё РґРѕР±Р°РІР»РµРЅС‹ РІ РѕС‡РµСЂРµРґСЊ РЅР° СѓРґР°Р»РµРЅРёРµ.");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("РќРµ СѓРґР°Р»РѕСЃСЊ РґРѕР±Р°РІРёС‚СЊ РєР»СЋС‡Рё РІ РѕС‡РµСЂРµРґСЊ.");
        }
    }

    //РћС‚РїСЂР°РІРёС‚СЊ РєР»СЋС‡Рё РІСЃРµРј РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРј
    @PostMapping("/send")
    public ResponseEntity<?> sendKeys(@RequestHeader("X-User-Id") UUID userId,
                                      @RequestBody SendEncryptKeyDto sendEncryptKeyDto) {
        try {
            return ResponseEntity.ok(sendMessageKeyService.sendEncryptKey(userId, sendEncryptKeyDto));
        } catch (SaveToDatabaseException e) {
            return ResponseEntity.status(500).body(e.getMessage());
        } catch (ChatNotFoundException e) {
            return ResponseEntity.status(404).body(e.getMessage());
        } catch (UserBlockedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        }
    }

    @GetMapping("/pending")
    public ResponseEntity<?> getPendingKeys(@RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(sendMessageKeyService.getPendingKeysForUser(userId));
    }
}
