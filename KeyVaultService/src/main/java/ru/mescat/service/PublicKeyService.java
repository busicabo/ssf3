package ru.mescat.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.mescat.entity.PublicKeyEntity;
import ru.mescat.repository.PublicKeyRepository;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class PublicKeyService {

    private PublicKeyRepository repository;

    public PublicKeyService(PublicKeyRepository repository){
        this.repository=repository;
    }

    public List<PublicKeyEntity> findAllById(UUID userId){
        return repository.findAllById(Collections.singleton(userId));
    }

    public List<PublicKeyEntity> findAllById(List<UUID> ids){
        return repository.findAllById(ids);
    }

    @Transactional
    public PublicKeyEntity save(PublicKeyEntity entity){
        if (entity == null || entity.getUserId() == null) {
            throw new IllegalArgumentException("Public key userId must not be empty.");
        }

        repository.upsertByUserId(entity.getUserId(), entity.getKey());
        PublicKeyEntity saved = repository.findTopByUserIdOrderByCreatedAtDescIdDesc(entity.getUserId());
        if (saved == null) {
            throw new IllegalStateException("Public key was not saved.");
        }
        log.info("Сохранен публичный ключ: keyId={}, userId={}", saved.getId(), saved.getUserId());
        return saved;
    }

    @Transactional
    public void deleteById(UUID id){
        repository.deleteById(id);
        log.info("Удален публичный ключ: keyId={}", id);
    }

   public PublicKeyEntity findById(UUID id){
        return repository.findById(id).orElse(null);
   }

   public PublicKeyEntity findByUserId(UUID userId){
        return repository.findTopByUserIdOrderByCreatedAtDescIdDesc(userId);
   }

   public List<PublicKeyEntity> findAllByUserIdIn(List<UUID> userIds){
        return repository.findAllByUserIdInOrderByCreatedAtDesc(userIds);
   }

}
