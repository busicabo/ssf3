package ru.mescat.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import ru.mescat.entity.PublicKeyEntity;

import java.util.List;
import java.util.UUID;

public interface PublicKeyRepository extends JpaRepository<PublicKeyEntity, UUID> {
    PublicKeyEntity findTopByUserIdOrderByCreatedAtDescIdDesc(UUID userId);

    @Query(
            value = """
                    select *
                    from public_keys
                    where user_id in (:userIds)
                    order by user_id, created_at desc, id desc
                    """,
            nativeQuery = true
    )
    List<PublicKeyEntity> findAllByUserIdInOrderByCreatedAtDesc(List<UUID> userIds);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            value = """
                    insert into public_keys (user_id, key)
                    values (:userId, :key)
                    on conflict (user_id) do update
                    set id = gen_random_uuid(),
                        key = excluded.key,
                        created_at = now()
                    """,
            nativeQuery = true
    )
    int upsertByUserId(UUID userId, byte[] key);
}
