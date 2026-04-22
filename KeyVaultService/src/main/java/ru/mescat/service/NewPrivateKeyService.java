package ru.mescat.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ru.mescat.entity.NewPrivateKeyEntity;
import ru.mescat.repository.NewPrivateKeyRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class NewPrivateKeyService {

    private NewPrivateKeyRepository newPrivateKeyRepository;

    public NewPrivateKeyService(NewPrivateKeyRepository newPrivateKeyRepository){
        this.newPrivateKeyRepository=newPrivateKeyRepository;
    }

    public List<NewPrivateKeyEntity> findAllByUserId(UUID userId){
        return newPrivateKeyRepository.findByUserIdOrderByCreatedAtAsc(userId);
    }

    public NewPrivateKeyEntity findLatestByUserId(UUID userId) {
        return newPrivateKeyRepository.findFirstByUserIdOrderByCreatedAtDesc(userId);
    }

    public NewPrivateKeyEntity save(NewPrivateKeyEntity newPrivateKeyEntity){
        NewPrivateKeyEntity saved = newPrivateKeyRepository.save(newPrivateKeyEntity);
        log.info("Сохранен приватный ключ: keyId={}, userId={}", saved.getId(), saved.getUserId());
        return saved;
    }

    public List<UUID> findIdsByCreatedAtBefore(OffsetDateTime offsetDateTime){
        return newPrivateKeyRepository.findIdsByCreatedAtBefore(offsetDateTime);
    }

    public void deleteAllById(List<UUID> uuids){
        newPrivateKeyRepository.deleteAllById(uuids);
        log.info("Удалены приватные ключи: count={}", uuids != null ? uuids.size() : 0);
    }
}
