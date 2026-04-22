package ru.mescat.client.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.mescat.client.dto.AddUserInChatDto;
import ru.mescat.client.dto.CreateGroupChatDto;
import ru.mescat.client.dto.CreatePersonalChatDto;
import ru.mescat.client.dto.UserBlockDto;
import ru.mescat.client.service.MessageServiceProxy;

import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ChatController {

    private final MessageServiceProxy proxy;

    public ChatController(MessageServiceProxy proxy) {
        this.proxy = proxy;
    }

    @GetMapping("/chats")
    public ResponseEntity<?> getChats(Authentication authentication) {
        return proxy.get("/api/chats", userId(authentication));
    }

    @GetMapping("/sidebar/chats")
    public ResponseEntity<?> getSidebarChats(Authentication authentication) {
        return proxy.get("/api/sidebar/chats", userId(authentication));
    }

    @GetMapping("/chats/{chatId}/members")
    public ResponseEntity<?> getChatMembers(@PathVariable Long chatId,
                                            Authentication authentication) {
        return proxy.get("/api/chats/" + chatId + "/members", userId(authentication));
    }

    @PostMapping("/personal_chat")
    public ResponseEntity<?> createPersonalChat(@RequestBody CreatePersonalChatDto dto,
                                                Authentication authentication) {
        return proxy.post("/api/personal_chat", userId(authentication), dto);
    }

    @PostMapping("/group_chat")
    public ResponseEntity<?> createGroupChat(@RequestBody CreateGroupChatDto dto,
                                             Authentication authentication) {
        return proxy.post("/api/group_chat", userId(authentication), dto);
    }

    @PostMapping("/block_user")
    public ResponseEntity<?> blockUser(@RequestBody UserBlockDto userBlockDto,
                                       Authentication authentication) {
        return proxy.post("/api/block_user", userId(authentication), userBlockDto);
    }

    @PostMapping("/add_user_in_chat")
    public ResponseEntity<?> addUserInChat(@RequestBody AddUserInChatDto dto,
                                           Authentication authentication) {
        return proxy.post("/api/add_user_in_chat", userId(authentication), dto);
    }

    @PostMapping("/delete_user_in_chat")
    public ResponseEntity<?> deleteUserInChat(@RequestBody AddUserInChatDto dto,
                                              Authentication authentication) {
        return proxy.post("/api/delete_user_in_chat", userId(authentication), dto);
    }

    @DeleteMapping("/chats/{chatId}")
    public ResponseEntity<?> deleteChat(@PathVariable Long chatId,
                                        Authentication authentication) {
        return proxy.delete("/api/chats/" + chatId, userId(authentication));
    }

    private UUID userId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
