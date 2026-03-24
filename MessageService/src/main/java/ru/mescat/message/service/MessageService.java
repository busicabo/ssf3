package ru.mescat.message.service;

import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import ru.mescat.message.dto.ChatDto;
import ru.mescat.message.dto.MessageDto;
import ru.mescat.message.dto.NewMessageToNewChat;
import ru.mescat.message.entity.ChatEntity;
import ru.mescat.message.entity.MessageEntity;
import ru.mescat.message.entity.enums.ChatType;
import ru.mescat.message.exception.ChatNotFoundException;
import ru.mescat.message.exception.NotFoundException;
import ru.mescat.message.exception.RemoteServiceException;
import ru.mescat.message.exception.UserBlockedException;
import ru.mescat.message.map.MessageEntityMessageDtoMapper;
import ru.mescat.message.repository.MessageRepository;
import ru.mescat.message.websocket.WebSocketService;
import ru.mescat.user.dto.User;
import ru.mescat.user.service.UserService;
import tools.jackson.databind.ObjectMapper;

import java.nio.file.AccessDeniedException;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
public class MessageService {
    private MessageRepository repository;
    private ChatUserService chatUserService;
    private UsersBlackListService blackListService;
    private WebSocketService webSocketService;
    private ChatService chatService;
    private UserService userService;
    private static final ObjectMapper objectMapper = new ObjectMapper();

    public MessageService(MessageRepository messageRepository,
                          ChatUserService chatUserService,
                          UsersBlackListService usersBlackListService,
                          WebSocketService webSocketService,
                          ChatService chatService,
                          UserService userService){
        this.userService=userService;
        this.chatService=chatService;
        this.webSocketService=webSocketService;
        this.blackListService=usersBlackListService;
        this.chatUserService=chatUserService;
        this.repository=messageRepository;
    }

    public MessageEntity save(MessageEntity message) {
        return repository.save(message);
    }

    public MessageEntity findById(Long messageId) {
        return repository.findById(messageId).orElse(null);
    }

    public boolean existsById(Long messageId) {
        return repository.existsById(messageId);
    }

    public void deleteById(Long messageId) {
        repository.deleteById(messageId);
    }

    public void sendMessage(MessageEntity message){
        if(!chatUserService.existsByChatIdAndUserId(message.getChat().getChatId(),message.getSenderId())){
            throw new ChatNotFoundException("Чат не существует.");
        }

        if(blackListService.isBlockedInChat(message.getChat().getChatId(),message.getSenderId())){
            throw new UserBlockedException("Вас заблокировали в данном чате.");
        }

        MessageEntity messageEntity;

        try{
            messageEntity = repository.save(message);
        } catch (Exception e){
            throw new RemoteServiceException(1,"Не удалось сохранить сообщение.");
        }

        MessageDto messageDto = MessageEntityMessageDtoMapper.convert(messageEntity);

        String json;
        try {
            json = objectMapper.writeValueAsString(messageDto);
        } catch (Exception e){
            throw new RuntimeException(e.getMessage());
        }
        webSocketService.sendToTopic(json,messageDto.getChatId());
    }

    public List<MessageEntity> getLastNMessagesForEachUserChat(UUID userId, int limit) {
        if (limit <= 0) {
            throw new IllegalArgumentException("Лимит должно быть больше 0.");
        }
        return repository.findLastNMessagesForEachUserChat(userId, limit);
    }

    public List<MessageEntity> getMessagesRelativeToMessage(Long messageId, int count) {
        if (count == 0) {
            return List.of();
        }

        UUID userId = UUID.fromString(SecurityContextHolder.getContext().getAuthentication().getName());

        MessageEntity message = findById(messageId);
        if(message==null){
            throw new NotFoundException("Сообщение не найдено.");
        }

        if(!chatUserService.existsByChatIdAndUserId(message.getChat().getChatId(),userId)){
            throw new ChatNotFoundException("Чат не найден.");
        };

        MessageEntity anchorMessage = repository.findById(messageId)
                .orElseThrow(() -> new NotFoundException("Message not found: " + messageId));
        Long chatId = anchorMessage.getChat().getChatId();
        int limit = Math.abs(count);

        if (count > 0) {
            return repository.findMessagesAfter(
                    chatId,
                    messageId,
                    PageRequest.of(0, limit)
            );
        }
        List<MessageEntity> result = repository.findMessagesBefore(
                chatId,
                messageId,
                PageRequest.of(0, limit)
        );

        Collections.reverse(result);
        return result;
    }

    public MessageEntity findLatestMessageByChatId(Long chatId){
        return repository.findFirstByChat_ChatIdOrderByCreatedAtDesc(chatId);
    }

    public ChatDto sendMessageAndCreateChat(NewMessageToNewChat message){

        User user = userService.findById(message.getUserId());

        UUID userId = UUID.fromString(SecurityContextHolder.getContext().getAuthentication().getName());
        ChatEntity chat = chatUserService.findPersonalBetween(message.getUserId(),userId,ChatType.PERSONAL);

        if(chat==null){
            chat = new ChatEntity(ChatType.PERSONAL);
            chat = chatService.save(chat);
        }
        sendMessage(new MessageEntity(chat,message.getMessage(),message.getKeyName()));

        return new ChatDto(chat.getChatId(),chat.getChatType(),user.getUsername(),
                user.getAvatarUrl(),message.getMessage(),message.getKeyName());

    }
}
