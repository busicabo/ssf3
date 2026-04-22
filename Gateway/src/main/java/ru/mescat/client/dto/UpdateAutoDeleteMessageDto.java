package ru.mescat.client.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.time.OffsetDateTime;

@Setter
@Getter
@ToString
@NoArgsConstructor
public class UpdateAutoDeleteMessageDto {
    private OffsetDateTime value;
}
