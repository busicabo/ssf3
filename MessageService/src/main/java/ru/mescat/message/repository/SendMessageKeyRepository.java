package ru.mescat.message.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import ru.mescat.message.entity.SendMessageKeyEntity;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SendMessageKeyRepository extends JpaRepository<SendMessageKeyEntity, UUID> {

    List<SendMessageKeyEntity> findAllByUserId(UUID userId);

    List<SendMessageKeyEntity> findAllByUserTargetId(UUID userTargetId);

    Optional<SendMessageKeyEntity> findByUserIdAndUserTargetId(UUID userId, UUID userTargetId);

    List<SendMessageKeyEntity> findAllByPublicKey(UUID publicKey);

    boolean existsByUserIdAndUserTargetId(UUID userId, UUID userTargetId);

    void deleteByUserIdAndUserTargetId(UUID userId, UUID userTargetId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from SendMessageKeyEntity k where k.id = :id and k.userTargetId = :userTargetId")
    int deleteOwnedById(UUID id, UUID userTargetId);
}
