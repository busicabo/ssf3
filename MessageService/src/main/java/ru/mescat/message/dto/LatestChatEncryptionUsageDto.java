package ru.mescat.message.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class LatestChatEncryptionUsageDto {
    private Long chatId;
    private String encryptionName;
    private long count;
}

