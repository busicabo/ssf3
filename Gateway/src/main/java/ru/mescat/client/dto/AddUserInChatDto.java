package ru.mescat.client.dto;

import lombok.*;

import java.util.UUID;

@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
@ToString
public class AddUserInChatDto {
    private UUID userTarget;
    private Long chatId;
}
