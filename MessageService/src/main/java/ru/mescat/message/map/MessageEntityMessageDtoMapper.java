package ru.mescat.message.map;

import ru.mescat.message.dto.MessageDto;
import ru.mescat.message.entity.MessageEntity;

public class MessageEntityMessageDtoMapper {
    public static MessageDto convert(MessageEntity message){
        return new MessageDto(message.getChat().getChatId(),message.getMessage(),message.getEncryptionName());
    }
}
