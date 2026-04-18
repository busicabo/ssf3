package ru.mescat.message.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class EncryptMessageKeySendResultDto {
    private Long chatId;
    private UUID encryptName;
    private int recipients;
}

