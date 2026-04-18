package ru.mescat.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "send_new_key")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class NewPrivateKeyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "key", nullable = false)
    private byte[] key;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "public_key",nullable = false)
    private UUID publicKey;

    @Column(name = "encrypting_public_key", nullable = false)
    private UUID encryptingPublicKey;

    public NewPrivateKeyEntity(UUID userId, byte[] key, UUID publicKey, UUID encryptingPublicKey) {
        this.publicKey = publicKey;
        this.encryptingPublicKey = encryptingPublicKey;
        this.userId = userId;
        this.key = key;
    }
}
