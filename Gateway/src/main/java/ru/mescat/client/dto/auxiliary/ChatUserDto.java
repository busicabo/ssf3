package ru.mescat.client.dto.auxiliary;

import lombok.*;

import java.util.UUID;

@AllArgsConstructor
@NoArgsConstructor
@ToString
@Setter
@Getter
public class ChatUserDto {
    private UUID userId;
    private Long chatId;
}
