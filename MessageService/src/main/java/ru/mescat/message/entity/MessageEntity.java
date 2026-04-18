package ru.mescat.message.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "message")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "message_id")
    private Long messageId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_id", nullable = false)
    private ChatEntity chat;

    @Column(name = "message", nullable = false)
    private byte[] message;

    public MessageEntity(ChatEntity chat, byte[] message, String encryptionName, UUID senderId) {
        this.chat = chat;
        this.message = message;
        this.encryptionName = encryptionName;
        this.senderId = senderId;
    }

    @Column(name = "encryption_name", nullable = false)
    private String encryptionName;

    @Column(name = "sender_id", nullable = false)
    private UUID senderId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false,insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    public MessageEntity(ChatEntity chat, byte[] message, String encryptionName) {
        this.chat = chat;
        this.message = message;
        this.encryptionName = encryptionName;
    }
}
