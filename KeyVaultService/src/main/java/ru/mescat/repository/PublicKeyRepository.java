package ru.mescat.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.mescat.entity.PublicKeyEntity;

import java.util.List;
import java.util.UUID;

public interface PublicKeyRepository extends JpaRepository<PublicKeyEntity, UUID> {
    PublicKeyEntity findTopByUserIdOrderByCreatedAtDescIdDesc(UUID userId);

    @Query(
            value = """
                    select distinct on (user_id) *
                    from public_keys
                    where user_id in (:userIds)
                    order by user_id, created_at desc, id desc
                    """,
            nativeQuery = true
    )
    List<PublicKeyEntity> findLatestByUserIdIn(List<UUID> userIds);
}
