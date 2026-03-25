package ru.mescat.message.dto;

import jakarta.persistence.Column;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.*;
import ru.mescat.message.entity.ChatEntity;

import java.time.OffsetDateTime;
import java.util.UUID;

@AllArgsConstructor
@NoArgsConstructor
@ToString
@Setter
@Getter
public class MessageForUser {
    private Long messageId;
    private Long chatId;
    private byte[] message;
    private String encryptionName;
    private UUID senderId;
    private OffsetDateTime createdAt;
}
