package ru.mescat.client.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import ru.mescat.client.dto.DeleteMessageDto;
import ru.mescat.client.dto.MessageDto;
import ru.mescat.client.dto.NewMessageToNewChat;
import ru.mescat.client.service.MessageServiceProxy;

import java.util.UUID;

@RestController
@RequestMapping("/api")
public class MessageController {

    private final MessageServiceProxy proxy;

    public MessageController(MessageServiceProxy proxy) {
        this.proxy = proxy;
    }

    @GetMapping("/getLastMessages/{count}")
    public ResponseEntity<?> getLastMessage(@PathVariable Integer count,
                                            Authentication authentication) {
        return proxy.get("/api/getLastMessages/" + count, userId(authentication));
    }

    @GetMapping("/getMessageInChatWithLimit/{messageId}/{count}")
    public ResponseEntity<?> getMessageInChatWithLimit(@PathVariable Long messageId,
                                                       @PathVariable Integer count,
                                                       Authentication authentication) {
        return proxy.get("/api/getMessageInChatWithLimit/" + messageId + "/" + count, userId(authentication));
    }

    @GetMapping("/messages/{chatId}")
    public ResponseEntity<?> getMessagesInChat(@PathVariable Long chatId,
                                               @RequestParam(defaultValue = "50") Integer limit,
                                               Authentication authentication) {
        return proxy.get("/api/messages/" + chatId + "?limit=" + limit, userId(authentication));
    }

    @PostMapping("/sendMessage")
    public ResponseEntity<?> sendMessage(@RequestBody MessageDto messageDto,
                                         Authentication authentication) {
        return proxy.post("/api/sendMessage", userId(authentication), messageDto);
    }

    @PostMapping("/newMessageAndNewChat")
    public ResponseEntity<?> newMessageAndNewChat(@RequestBody NewMessageToNewChat newMessageToNewChat,
                                                   Authentication authentication) {
        return proxy.post("/api/newMessageAndNewChat", userId(authentication), newMessageToNewChat);
    }

    @PostMapping("/delete")
    public ResponseEntity<?> deleteMessage(@RequestBody DeleteMessageDto deleteMessageDto,
                                           Authentication authentication) {
        return proxy.post("/api/delete", userId(authentication), deleteMessageDto);
    }

    private UUID userId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
