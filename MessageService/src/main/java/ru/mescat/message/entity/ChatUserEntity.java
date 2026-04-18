package ru.mescat.message.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import ru.mescat.message.service.ChatUserService;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "chat_users",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"chat_id", "user_id"})
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatUserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_id", nullable = false)
    private ChatEntity chat;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    public ChatUserEntity(ChatEntity chat, UUID userId, String role) {
        this.chat = chat;
        this.userId = userId;
        this.role = role;
    }

    @Column(name = "role", nullable = false)
    private String role;

    @CreationTimestamp
    @Column(name = "joined_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime joinedAt;

    public ChatUserEntity(ChatEntity chat, UUID userId){
        this.chat = chat;
        this.userId = userId;
        this.role = "MEMBER";
    }
}
