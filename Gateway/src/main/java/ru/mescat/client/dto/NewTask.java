package ru.mescat.client.dto;

import lombok.*;
import tools.jackson.databind.JsonNode;

import java.time.OffsetDateTime;
import java.util.UUID;

@AllArgsConstructor
@NoArgsConstructor
@ToString
@Setter
@Getter
public class NewTask {
    private UUID userId;
    private TaskType task;
    private OffsetDateTime createdAt;
    private JsonNode payload;
}
