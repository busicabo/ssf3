package ru.mescat.message.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.mescat.message.entity.UsersBlackListEntity;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UsersBlackListRepository extends JpaRepository<UsersBlackListEntity, Long> {

    boolean existsByUserInitiatorAndChat_ChatIdAndUserTarget(UUID userInitiator, Long chatId, UUID userTarget);

    boolean existsByChat_ChatIdAndUserTarget(Long chatId, UUID userTarget);

    List<UsersBlackListEntity> findAllByUserInitiator(UUID userInitiator);

    List<UsersBlackListEntity> findAllByUserTarget(UUID userTarget);

    List<UsersBlackListEntity> findAllByChat_ChatId(Long chatId);

    Optional<UsersBlackListEntity> findByUserInitiatorAndChat_ChatIdAndUserTarget(UUID userInitiator, Long chatId, UUID userTarget);

    void deleteByUserInitiatorAndChat_ChatIdAndUserTarget(UUID userInitiator, Long chatId, UUID userTarget);

    @Query("""
            select ubl.userTarget
            from UsersBlackListEntity ubl
            where ubl.chat.chatId = :chatId
            """)
    List<UUID> getAllUserIdBlocksByChatId(@Param("chatId") Long chatId);
}