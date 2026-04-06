package ru.mescat.client.dto;

import lombok.*;

@AllArgsConstructor
@NoArgsConstructor
@ToString
@Setter
@Getter
public class CreateGroupChatDto {
    private String title;
    private String avatarUrl;
}
