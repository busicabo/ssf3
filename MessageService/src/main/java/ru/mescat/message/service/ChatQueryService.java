package ru.mescat.message.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.mescat.message.dto.ChatDto;
import ru.mescat.message.entity.ChatUserEntity;
import ru.mescat.message.map.ToChatDtoMapper;
import ru.mescat.message.map.UserChatDtoMap;
import ru.mescat.user.dto.User;
import ru.mescat.user.service.UserService;

import java.util.List;
import java.util.UUID;

@Service
public class ChatQueryService {

    private final ChatUserService chatUserService;
    private final ToChatDtoMapper toChatDtoMapper;
    private final UserService userService;
    private final UserChatDtoMap userChatDtoMap;

    public ChatQueryService(ChatUserService chatUserService,
                            ToChatDtoMapper toChatDtoMapper,
                            UserService userService,
                            UserChatDtoMap userChatDtoMap) {
        this.chatUserService = chatUserService;
        this.toChatDtoMapper = toChatDtoMapper;
        this.userService = userService;
        this.userChatDtoMap = userChatDtoMap;
    }

    @Transactional(readOnly = true)
    public List<ChatDto> getChatsForUser(UUID userId) {
        List<ChatUserEntity> chats = chatUserService.findAllByUserId(userId);
        if (chats == null) {
            return null;
        }
        return toChatDtoMapper.convert(chats, userId);
    }

    @Transactional(readOnly = true)
    public List<ChatDto> searchUsersAsChats(UUID userId, String username) {
        List<User> users = userService.findByUsernameContaining(username);
        if (users == null || users.isEmpty()) {
            return List.of();
        }
        return userChatDtoMap.convert(users, userId);
    }
}
