package ru.mescat.client.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@ToString
public class MessageKeyRequestDto {
    private Long chatId;
    private Long messageId;
    private String encryptName;
    private UUID senderId;
    private UUID requesterId;
}
