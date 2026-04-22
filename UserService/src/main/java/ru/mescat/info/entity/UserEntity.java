package ru.mescat.info.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name="users")
@Setter
@Getter
@NoArgsConstructor
@ToString
public class UserEntity {
    @Id
    @Column(name = "id")
    @UuidGenerator
    @GeneratedValue
    private UUID id;

    @Column(name="username", nullable = false, unique = true)
    private String username;

    @Column(name="password", nullable = false)
    private String password;

    @Column(name = "blocked", nullable = false)
    private boolean blocked;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    public UserEntity(String username, String password) {
        this.username = username;
        this.password = password;
    }

    @Column(name="avatar_url", nullable = false, insertable = false)
    private String avatarUrl;

    @Column(name = "online", nullable = false)
    private boolean online;

    public UserEntity(String username, String password, boolean blocked, boolean online) {
        this.username = username;
        this.password = password;
        this.blocked = blocked;
        this.online = online;
    }
}
