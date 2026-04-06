package ru.mescat.client.dto;

import lombok.*;

@AllArgsConstructor
@NoArgsConstructor
@ToString
@Setter
@Getter
public class DeleteMessageDto {
    private Long chatId;
    private Long messageId;
}
