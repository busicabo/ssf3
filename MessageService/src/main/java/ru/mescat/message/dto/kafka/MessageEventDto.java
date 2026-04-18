package ru.mescat.message.dto.kafka;

import lombok.*;

@AllArgsConstructor
@NoArgsConstructor
@ToString
@Setter
@Getter
public class MessageEventDto {
    private MessageEventType type;
    private Object payload;
}
