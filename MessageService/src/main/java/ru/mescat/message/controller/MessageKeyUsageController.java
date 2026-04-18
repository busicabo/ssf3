package ru.mescat.message.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.mescat.message.dto.LatestChatEncryptionUsageDto;
import ru.mescat.message.exception.ChatNotFoundException;
import ru.mescat.message.service.MessageService;

import java.util.UUID;

@RestController
@RequestMapping("/api/key-usage")
public class MessageKeyUsageController {

    private final MessageService messageService;

    public MessageKeyUsageController(MessageService messageService) {
        this.messageService = messageService;
    }

    @GetMapping("/chats/{chatId}/latest")
    public ResponseEntity<?> getLatestUsage(@RequestHeader("X-User-Id") UUID userId,
                                            @PathVariable Long chatId) {
        if (chatId == null || chatId <= 0) {
            return ResponseEntity.badRequest().body("Некорректный chatId.");
        }

        try {
            LatestChatEncryptionUsageDto usage = messageService.getLatestEncryptionUsage(userId, chatId);
            return ResponseEntity.ok(usage);
        } catch (ChatNotFoundException e) {
            return ResponseEntity.status(404).body(e.getMessage());
        }
    }
}

