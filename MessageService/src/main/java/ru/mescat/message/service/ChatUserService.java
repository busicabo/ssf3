package ru.mescat.message.service;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.mescat.message.dto.AddUserInChatDto;
import ru.mescat.message.dto.DeleteUserInChatDto;
import ru.mescat.message.dto.auxiliary.ChatUserDto;
import ru.mescat.message.entity.ChatEntity;
import ru.mescat.message.entity.ChatUserEntity;
import ru.mescat.message.entity.enums.ChatType;
import ru.mescat.message.event.dto.NewUserInChat;
import ru.mescat.message.exception.AccessDeniedException;
import ru.mescat.message.exception.ChatNotFoundException;
import ru.mescat.message.exception.NotFoundException;
import ru.mescat.message.repository.ChatUserRepository;
import ru.mescat.user.dto.User;
import ru.mescat.user.dto.UserSettings;
import ru.mescat.user.service.UserService;

import java.util.List;
import java.util.UUID;

@Service
public class ChatUserService {

    private final ChatUserRepository repository;
    private final ChatService chatService;
    private final UserService userService;
    private final ApplicationEventPublisher applicationEventPublisher;

    public ChatUserService(ChatUserRepository repository,
                           ChatService chatService,
                           UserService userService,
                           ApplicationEventPublisher applicationEventPublisher) {
        this.repository = repository;
        this.chatService = chatService;
        this.userService = userService;
        this.applicationEventPublisher = applicationEventPublisher;
    }

    public ChatUserEntity save(ChatUserEntity chatUserEntity) {
        ChatUserEntity result = repository.save(chatUserEntity);
        applicationEventPublisher.publishEvent(new NewUserInChat(result));
        return result;
    }

    public ChatUserEntity findById(Long id) {
        return repository.findById(id).orElse(null);
    }

    public List<ChatUserEntity> findAllByUserId(UUID userId) {
        return repository.findAllByUserId(userId);
    }

    public boolean existsById(Long id) {
        return repository.existsById(id);
    }

    public boolean existsByChatIdAndUserId(Long chatId, UUID userId) {
        return repository.existsByChat_ChatIdAndUserId(chatId, userId);
    }

    public void deleteById(Long id) {
        repository.deleteById(id);
    }

    public List<ChatUserDto> findAllChatUsersByChatIds(List<Long> chatIds, UUID noTargetUser) {
        return repository.findAllChatUsersByChatIds(chatIds, noTargetUser);
    }

    public ChatEntity findPersonalBetween(UUID user1, UUID user2, ChatType chatType) {
        return repository.findPersonalChatBetween(user1, user2, chatType);
    }

    public List<UUID> findAllUserIdNotBlocksByChatId(Long chatId) {
        return repository.findAllUserIdNotBlocksByChatId(chatId);
    }

    public List<UUID> findAllUserIdsByChatId(Long chatId) {
        return repository.findAllUserIdsByChatId(chatId);
    }

    public List<ChatUserEntity> findAllNotBlocksByChatId(Long chatId) {
        return repository.findAllNotBlocksByChatId(chatId);
    }

    public ChatUserEntity findByUserIdAndChatId(Long chatId, UUID userId) {
        return repository.findByUserIdAndChatId(chatId, userId);
    }

    @Transactional
    public ChatUserEntity addNewUserInChat(AddUserInChatDto dto) {
        if (dto == null || dto.getChatId() == null || dto.getUserTarget() == null) {
            throw new IllegalArgumentException("Invalid member add request.");
        }

        ChatEntity chat = chatService.findById(dto.getChatId());
        if (chat == null) {
            throw new ChatNotFoundException("Chat not found.");
        }

        if (chat.getChatType() == ChatType.PERSONAL) {
            throw new AccessDeniedException("Personal chats cannot have extra members.");
        }

        User user = userService.findById(dto.getUserTarget());
        if (user == null) {
            throw new NotFoundException("User not found.");
        }

        ChatUserEntity existing = findByUserIdAndChatId(dto.getChatId(), user.getId());
        if (existing != null) {
            return existing;
        }

        UserSettings userSettings = userService.getSettingsById(user.getId());
        if (userSettings != null && !userSettings.isAllowAddChat()) {
            throw new AccessDeniedException("User disabled adding to chats.");
        }

        return save(new ChatUserEntity(chat, user.getId()));
    }

    @Transactional
    public void deleteUserFromChat(DeleteUserInChatDto dto, UUID userId) {
        if (dto == null || dto.getChatId() == null || dto.getUserTarget() == null) {
            throw new IllegalArgumentException("Запрос не валидный.");
        }

        ChatUserEntity target = findByUserIdAndChatId(dto.getChatId(), dto.getUserTarget());
        if (target == null) {
            throw new NotFoundException("Пользователь не найден.");
        }

        ChatUserEntity initiator = repository.findByUserIdAndChatId(dto.getChatId(),userId);

        if(initiator==null){
            throw new AccessDeniedException("Вы не состоите в данном чате.");
        }

        if(!initiator.getRole().equalsIgnoreCase("ADMIN")
                && !initiator.getRole().equalsIgnoreCase("CREATOR")){
            throw new AccessDeniedException("У вас нету прав на исключение пользователя из чата.");
        }

        deleteById(target.getId());
    }
}
