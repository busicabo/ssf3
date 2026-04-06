package ru.mescat.client.dto;

import lombok.*;
import ru.mescat.message.entity.enums.ChatType;

@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
@ToString
@Builder
public class ChatDto {
    private Long chatId;
    private ChatType chatType;
    private String title;
    private String avatarUrl;
    private byte[] lastMessage;
    private String encryptName;

    public ChatDto(ChatType chatType, String title, String avatarUrl) {
        this.chatType = chatType;
        this.title = title;
        this.avatarUrl = avatarUrl;
    }

    public ChatDto(Long chatId, ChatType chatType, String title, String avatarUrl) {
        this.chatId = chatId;
        this.chatType = chatType;
        this.title = title;
        this.avatarUrl = avatarUrl;
    }
}
