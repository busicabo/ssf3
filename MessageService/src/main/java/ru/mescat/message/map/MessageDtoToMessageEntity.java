package ru.mescat.message.map;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import ru.mescat.message.dto.MessageDto;
import ru.mescat.message.entity.ChatEntity;
import ru.mescat.message.entity.MessageEntity;
import ru.mescat.message.exception.ChatNotFoundException;
import ru.mescat.message.service.ChatService;

import java.util.UUID;

@Component
public class MessageDtoToMessageEntity {

    private ChatService chatService;

    public MessageDtoToMessageEntity(ChatService chatService){
        this.chatService=chatService;
    }

    public MessageEntity convert(MessageDto messageDto){
        ChatEntity chat = chatService.findById(messageDto.getChatId());
        if(chat==null){
            throw new ChatNotFoundException("Чат не найден.");
        }

        UUID userId = UUID.fromString(SecurityContextHolder.getContext().getAuthentication().getName());

        return new MessageEntity(chat,messageDto.getMessage(),messageDto.getEncryptionName(),userId);
    }
}
