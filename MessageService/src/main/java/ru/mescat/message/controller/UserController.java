package ru.mescat.message.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.mescat.message.dto.ChatDto;
import ru.mescat.message.exception.RemoteServiceException;
import ru.mescat.message.map.UserChatDtoMap;
import ru.mescat.user.dto.User;
import ru.mescat.user.service.UserService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class UserController {

    private final UserService userService;
    private final UserChatDtoMap userChatDtoMap;

    public UserController(UserService userService, UserChatDtoMap userChatDtoMap){
        this.userChatDtoMap=userChatDtoMap;
        this.userService = userService;
    }

    @GetMapping("/{username}/getId")
    public ResponseEntity<?> getIdByUsername(@PathVariable String username){
        if(username==null){
            return ResponseEntity.notFound().build();
        }

        try{
            UUID userId = userService.getIdByUsername(username);

            return ResponseEntity.ok(userId);
        } catch (Exception e){
            return ResponseEntity.status(502).body("Не удалось получить данные от сервера.");
        }

    }

    @GetMapping("/search_by_username")
    public ResponseEntity<?> searchByUsername(@RequestParam String username){
        if(username == null || username.isBlank()){
            return ResponseEntity.status(400).build();
        }
        List<User> users = userService.findByUsernameContaining(username);

        if(users==null || users.isEmpty()){
            return ResponseEntity.ok(List.of());
        }
        List<ChatDto> chatDtos = userChatDtoMap.convert(users);

        if(chatDtos==null){
            return ResponseEntity.status(500).body("Не удалось подготовить чаты.");
        }

        return ResponseEntity.ok(chatDtos);
    }
}
