package ru.mescat.message.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import ru.mescat.message.entity.FileEntity;
import ru.mescat.message.entity.enums.FileStatus;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FileRepository extends JpaRepository<FileEntity, UUID> {

    List<FileEntity> findByChat_ChatIdOrderByCreatedAtAsc(Long chatId);

    List<FileEntity> findByChat_ChatIdAndStatusOrderByCreatedAtAsc(Long chatId, FileStatus status);

    List<FileEntity> findByChat_ChatIdAndStatusOrderByCreatedAtDesc(Long chatId, FileStatus status, Pageable pageable);

    List<FileEntity> findByChat_ChatIdAndStatusAndCreatedAtBeforeOrderByCreatedAtDesc(
            Long chatId,
            FileStatus status,
            OffsetDateTime createdAt,
            Pageable pageable
    );

    Optional<FileEntity> findByFileIdAndChat_ChatId(UUID fileId, Long chatId);

    Optional<FileEntity> findByFileIdAndStatus(UUID fileId, FileStatus status);

    List<FileEntity> findTop100ByStatusAndUploadUrlExpiresAtBeforeOrderByUploadUrlExpiresAtAsc(
            FileStatus status,
            OffsetDateTime uploadUrlExpiresAt
    );
}
