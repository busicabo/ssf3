package ru.mescat.message.dto.kafka;

import lombok.*;

@AllArgsConstructor
@NoArgsConstructor
@ToString
@Setter
@Getter
public class EncryptKeyEventDto {
    private EncryptKeyType type;
    private Object payload;
}
