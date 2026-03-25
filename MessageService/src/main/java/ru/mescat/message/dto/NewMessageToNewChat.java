package ru.mescat.message.dto;

import lombok.*;

import java.util.UUID;

@AllArgsConstructor
@NoArgsConstructor
@ToString
@Setter
@Getter
public class NewMessageToNewChat {
    private UUID userId;
    private byte[] message;
    private String encryptName;
}
