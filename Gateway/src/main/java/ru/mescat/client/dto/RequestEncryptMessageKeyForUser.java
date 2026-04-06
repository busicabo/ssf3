package ru.mescat.client.dto;

import lombok.*;

import java.util.UUID;

@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
@ToString
public class RequestEncryptMessageKeyForUser {
    private UUID userTarget;
    private byte[] key;
    private UUID publicKeyUser;
}