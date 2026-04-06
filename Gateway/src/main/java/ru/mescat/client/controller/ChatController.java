package ru.mescat.client.controller;


import org.apache.kafka.common.KafkaException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import ru.mescat.client.dto.CreateGroupChatDto;
import ru.mescat.client.dto.NewTask;
import ru.mescat.client.dto.TaskType;
import ru.mescat.client.dto.UserBlockDto;
import ru.mescat.client.service.SendNewTask;
import tools.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ChatController {

    private SendNewTask sendNewTask;
    private ObjectMapper objectMapper = new ObjectMapper();

    public ChatController(SendNewTask sendNewTask){
        this.sendNewTask=sendNewTask;
    }

    @GetMapping("/chats")
    public ResponseEntity<?> getChats(Authentication authentication){
        UUID userId = UUID.fromString(authentication.getName());


        return ResponseEntity.ok(chatDtos);
    }

    @PostMapping("/createGroupChat")
    public ResponseEntity<?> createGroutChat(@RequestBody CreateGroupChatDto dto, Authentication authentication){
        UUID userId = UUID.fromString(authentication.getName());
        try{
            sendNewTask.sendNewTask(
                    new NewTask(userId, TaskType.NEW_MESSAGE_AND_NEW_CHAT, OffsetDateTime.now(),objectMapper.valueToTree(dto)));
            return ResponseEntity.ok().build();
        } catch (KafkaException e){
            return ResponseEntity.status(500).body("Не удалось добавить задачу. Попробуйте еще раз.");
        }
    }

    @PostMapping("/blockUser")
    private ResponseEntity<?> blockUser(@RequestBody UserBlockDto userBlockDto, Authentication authentication){
        usersBlackListService.addBlock(userBlockDto);
    }



}
