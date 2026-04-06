package ru.mescat.client.dto.kafka;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.UUID;

@AllArgsConstructor
@Getter
public class KeyDelete {
    private UUID keyId;
}
