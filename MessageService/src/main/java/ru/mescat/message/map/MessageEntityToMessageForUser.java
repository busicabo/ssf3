package ru.mescat.message.map;

import ru.mescat.message.dto.MessageForUser;
import ru.mescat.message.entity.MessageEntity;

public class MessageEntityToMessageForUser {

    public static MessageForUser convert(MessageEntity message){
        return new MessageForUser(message.getMessageId(),message.getChat().getChatId(),
                message.getMessage(),message.getEncryptionName(),message.getSenderId(),message.getCreatedAt());
    }
}
