package ru.mescat.client.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import ru.mescat.client.dto.SendEncryptKeyDto;
import ru.mescat.client.dto.kafka.KeyDelete;
import ru.mescat.client.service.MessageServiceProxy;

import java.util.UUID;

@RestController
@RequestMapping("/api/encrypt_message_key")
public class EncryptMessageKeyController {

    private final MessageServiceProxy proxy;

    public EncryptMessageKeyController(MessageServiceProxy proxy) {
        this.proxy = proxy;
    }

    @PostMapping("/delete")
    public ResponseEntity<?> deleteMessageKey(@RequestBody KeyDelete keyDelete,
                                              Authentication authentication) {
        UUID userId = userId(authentication);
        keyDelete.setUserTargetId(userId);
        return proxy.post("/api/encrypt_message_key/delete", userId, keyDelete);
    }

    @PostMapping("/send")
    public ResponseEntity<?> sendKeys(@RequestBody SendEncryptKeyDto sendEncryptKeyDto,
                                      Authentication authentication) {
        return proxy.post("/api/encrypt_message_key/send", userId(authentication), sendEncryptKeyDto);
    }

    @GetMapping("/pending")
    public ResponseEntity<?> getPendingKeys(Authentication authentication) {
        return proxy.get("/api/encrypt_message_key/pending", userId(authentication));
    }

    private UUID userId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
