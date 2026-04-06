package ru.mescat.client.dto;

import java.time.OffsetDateTime;

public record ApiResponse(
        int code,
        String message,
        boolean success,
        OffsetDateTime data
) {}
