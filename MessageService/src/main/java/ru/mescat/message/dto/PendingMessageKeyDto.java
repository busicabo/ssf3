package ru.mescat.message.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class PendingMessageKeyDto {
    private UUID id;
    private Long chatId;
    private UUID userId;
    private UUID userTargetId;
    private byte[] key;
    private UUID publicKey;
    private String encryptName;
    private OffsetDateTime sendAt;
}
