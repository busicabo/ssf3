package ru.mescat.client.dto.auxiliary;

import lombok.*;

@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
@ToString
public class ChatIdLastMessageEncryptName {
    private Long chatId;
    private byte[] lastMessage;
    private String encryptName;
}
