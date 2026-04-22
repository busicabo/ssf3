package ru.mescat.message.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "send_message_keys")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SendMessageKeyEntity {

    public SendMessageKeyEntity(UUID userId, Long chatId, byte[] key, UUID publicKey, UUID userTargetId) {
        this.userId = userId;
        this.chatId = chatId;
        this.key = key;
        this.publicKey = publicKey;
        this.userTargetId = userTargetId;
    }

    @Id
    @Column(name = "id", nullable = false)
    @UuidGenerator
    @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "chat_id")
    private Long chatId;

    @Column(name = "key", nullable = false)
    private byte[] key;

    @Column(name = "public_key", nullable = false)
    private UUID publicKey;

    @Column(name = "user_target_id", nullable = false)
    private UUID userTargetId;

    @Column(name="encrypt_name", nullable = false)
    private String encryptName;

    @CreationTimestamp
    @Column(name = "send_at", nullable = false,insertable = false, updatable = false)
    private OffsetDateTime sendAt;

    public SendMessageKeyEntity(UUID userId, Long chatId, byte[] key, UUID publicKey, UUID userTargetId, String encryptName) {
        this.userId = userId;
        this.chatId = chatId;
        this.key = key;
        this.publicKey = publicKey;
        this.userTargetId = userTargetId;
        this.encryptName = encryptName;
    }
}
