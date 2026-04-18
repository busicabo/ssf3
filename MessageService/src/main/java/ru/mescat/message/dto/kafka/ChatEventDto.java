package ru.mescat.message.dto.kafka;

import lombok.*;

@AllArgsConstructor
@NoArgsConstructor
@ToString
@Setter
@Getter
public class ChatEventDto {
    private ChatEventType type;
    private Object payload;
}
