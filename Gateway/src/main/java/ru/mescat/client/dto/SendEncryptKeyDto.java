package ru.mescat.client.dto;

import lombok.*;

import java.util.List;
import java.util.UUID;

@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
@ToString
public class SendEncryptKeyDto {
    private Long chatId;
    private UUID encryptName;
    List<RequestEncryptMessageKeyForUser> requestEncryptMessageKeyForUsers;
}
