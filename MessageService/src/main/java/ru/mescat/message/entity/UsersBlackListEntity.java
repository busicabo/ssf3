package ru.mescat.message.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import ru.mescat.message.entity.ChatEntity;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users_black_list")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UsersBlackListEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_initiator", nullable = false)
    private UUID userInitiator;

    public UsersBlackListEntity(UUID userInitiator, ChatEntity chat, UUID userTarget) {
        this.userInitiator = userInitiator;
        this.chat = chat;
        this.userTarget = userTarget;
    }

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_id", nullable = false)
    private ChatEntity chat;

    @Column(name = "user_target")
    private UUID userTarget;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime createdAt;


}
