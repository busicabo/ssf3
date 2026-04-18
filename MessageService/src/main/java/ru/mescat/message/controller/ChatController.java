package ru.mescat.message.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.mescat.message.dto.*;
import ru.mescat.message.exception.AccessDeniedException;
import ru.mescat.message.exception.ChatNotFoundException;
import ru.mescat.message.exception.NotFoundException;
import ru.mescat.message.service.ChatQueryService;
import ru.mescat.message.service.ChatService;
import ru.mescat.message.service.ChatUserService;
import ru.mescat.message.service.MessageService;
import ru.mescat.message.service.UsersBlackListService;
import ru.mescat.user.service.UserService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ChatController {

    private final ChatService chatService;
    private final ChatUserService chatUserService;
    private final UserService userService;
    private final ChatQueryService chatQueryService;
    private final MessageService messageService;
    private final UsersBlackListService usersBlackListService;

    public ChatController(ChatService chatService,
                          ChatUserService chatUserService,
                          UserService userService,
                          ChatQueryService chatQueryService,
                          MessageService messageService,
                          UsersBlackListService usersBlackListService) {
        this.usersBlackListService = usersBlackListService;
        this.messageService = messageService;
        this.chatQueryService = chatQueryService;
        this.userService = userService;
        this.chatService = chatService;
        this.chatUserService = chatUserService;
    }


    //Р СџР С•Р В»РЎС“РЎвЂЎР С‘РЎвЂљРЎРЉ Р Р†РЎРѓР Вµ РЎвЂЎР В°РЎвЂљРЎвЂ№
    @GetMapping("/chats")
    public ResponseEntity<?> getChats(@RequestHeader("X-User-Id") UUID userId) {
        List<ChatDto> chatDtos = chatQueryService.getChatsForUser(userId);

        if (chatDtos == null) {
            return ResponseEntity.status(500).body("Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ РЎР‚Р В°РЎРѓР С—Р В°РЎР‚РЎРѓР С‘РЎвЂљРЎРЉ РЎвЂЎР В°РЎвЂљРЎвЂ№");
        }

        return ResponseEntity.ok(chatDtos);
    }

    @GetMapping("/chats/{chatId}/members")
    public ResponseEntity<?> getChatMembers(@RequestHeader("X-User-Id") UUID userId,
                                            @PathVariable Long chatId) {
        if (!chatUserService.existsByChatIdAndUserId(chatId, userId)) {
            return ResponseEntity.status(404).body("Р§Р°С‚ РЅРµ РЅР°Р№РґРµРЅ.");
        }

        return ResponseEntity.ok(chatUserService.findAllUserIdNotBlocksByChatId(chatId));
    }

    @PostMapping("/personal_chat")
    public ResponseEntity<?> createPersonalChat(@RequestHeader("X-User-Id") UUID userId,
                                                @RequestBody CreatePersonalChatDto dto) {
        if (dto == null || dto.getUserId() == null) {
            return ResponseEntity.badRequest().body("РРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РЅРµ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РїСѓСЃС‚С‹Рј.");
        }

        try {
            return ResponseEntity.ok(messageService.createPersonalChat(userId, dto.getUserId()));
        } catch (NotFoundException e) {
            return ResponseEntity.status(404).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ Р»РёС‡РЅС‹Р№ С‡Р°С‚.");
        }
    }


    //РЎРѓР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ Р С–РЎР‚РЎС“Р С—Р С—Р С•Р Р†Р С•Р в„– РЎвЂЎР В°РЎвЂљ
    @PostMapping("/group_chat")
    public ResponseEntity<?> createGroupChat(@RequestHeader("X-User-Id") UUID userId,
                                             @RequestBody CreateGroupChatDto dto) {
        if (dto == null) {
            return ResponseEntity.badRequest().body("Р СћР ВµР В»Р С• Р В·Р В°Р С—РЎР‚Р С•РЎРѓР В° Р Р…Р Вµ Р Т‘Р С•Р В»Р В¶Р Р…Р С• Р В±РЎвЂ№РЎвЂљРЎРЉ Р С—РЎС“РЎРѓРЎвЂљРЎвЂ№Р С.");
        }

        try {
            return ResponseEntity.ok(chatService.createGroupChat(userId, dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ РЎРѓР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ Р С–РЎР‚РЎС“Р С—Р С—Р С•Р Р†Р С•Р в„– РЎвЂЎР В°РЎвЂљ.");
        }
    }

    // Блокировка пользователя в чате.
    @PostMapping("/block_user")
    public ResponseEntity<?> blockUser(@RequestHeader("X-User-Id") UUID userId,
                                       @RequestBody UserBlockDto userBlockDto) {
        if (userBlockDto == null) {
            return ResponseEntity.badRequest().body("Тело запроса не должно быть пустым.");
        }

        try {
            usersBlackListService.addBlock(userId, userBlockDto);
            return ResponseEntity.ok("Пользователь успешно заблокирован.");
        } catch (ChatNotFoundException | NotFoundException e) {
            return ResponseEntity.status(404).body(e.getMessage());
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Не удалось заблокировать пользователя.");
        }
    }

    @PostMapping("/add_user_in_chat")
    public ResponseEntity<?> addUserInChat(@RequestHeader("X-User-Id") UUID userId,
                                           @RequestBody AddUserInChatDto dto){
        try{
            chatUserService.addNewUserInChat(dto);
            return ResponseEntity.ok().build();
        } catch (NotFoundException | ChatNotFoundException e){
            return ResponseEntity.status(404).body(e.getMessage());
        } catch (Exception e){
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/delete_user_in_chat")
    public ResponseEntity<?> deleteUserInChat(@RequestHeader("X-User-Id") UUID userId,
                                              @RequestBody AddUserInChatDto dto) {
        if (dto == null) {
            return ResponseEntity.badRequest().body("Р СћР ВµР В»Р С• Р В·Р В°Р С—РЎР‚Р С•РЎРѓР В° Р Р…Р Вµ Р Т‘Р С•Р В»Р В¶Р Р…Р С• Р В±РЎвЂ№РЎвЂљРЎРЉ Р С—РЎС“РЎРѓРЎвЂљРЎвЂ№Р С.");
        }

        try {
            chatUserService.deleteUserFromChat(dto, userId);
            return ResponseEntity.ok().build();
        } catch (NotFoundException | ChatNotFoundException e) {
            return ResponseEntity.status(404).body(e.getMessage());
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
}



