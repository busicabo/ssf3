package ru.mescat.client.dto;

import lombok.*;

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
