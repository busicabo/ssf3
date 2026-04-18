package ru.mescat.client.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.mescat.client.service.MessageServiceProxy;

import java.util.UUID;

@RestController
@RequestMapping("/api/key-usage")
public class MessageKeyUsageController {

    private final MessageServiceProxy proxy;

    public MessageKeyUsageController(MessageServiceProxy proxy) {
        this.proxy = proxy;
    }

    @GetMapping("/chats/{chatId}/latest")
    public ResponseEntity<?> getLatestUsage(@PathVariable Long chatId,
                                            Authentication authentication) {
        return proxy.get("/api/key-usage/chats/" + chatId + "/latest", userId(authentication));
    }

    private UUID userId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}

