package ru.mescat.client.dto;



import lombok.*;

@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
@ToString
public class MessageDto {
    private Long chatId;
    private byte[] message;
    private String encryptionName;
}
