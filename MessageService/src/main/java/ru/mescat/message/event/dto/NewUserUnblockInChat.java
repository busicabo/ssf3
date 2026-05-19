package ru.mescat.message.event.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.time.OffsetDateTime;
import java.util.UUID;

@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
@ToString
public class NewUserUnblockInChat {
    private Long chatId;
    private UUID userInitiator;
    private UUID userTarget;
    private OffsetDateTime createdAt;
}
