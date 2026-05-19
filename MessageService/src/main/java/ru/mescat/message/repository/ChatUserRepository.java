package ru.mescat.message.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.mescat.message.dto.auxiliary.ChatUserDto;
import ru.mescat.message.entity.ChatEntity;
import ru.mescat.message.entity.ChatUserEntity;
import ru.mescat.message.entity.enums.ChatType;

import java.util.List;
import java.util.UUID;

public interface ChatUserRepository extends JpaRepository<ChatUserEntity, Long> {
    List<ChatUserEntity> findAllByUserId(UUID userId);

    boolean existsByChat_ChatIdAndUserId(Long chatId, UUID userId);

    @Query("""
        select distinct new ru.mescat.message.dto.auxiliary.ChatUserDto(cu.userId, cu.chat.chatId)
        from ChatUserEntity cu
        where cu.chat.chatId in :chatIds
          and cu.userId <> :noTarget
        """)
    List<ChatUserDto> findAllChatUsersByChatIds(
            @Param("chatIds") List<Long> chatIds,
            @Param("noTarget") UUID noTarget
    );

    @Query("""
        select distinct cu1.chat
        from ChatUserEntity cu1
        join ChatUserEntity cu2 on cu1.chat = cu2.chat
        where cu1.userId = :currentUserId
          and cu2.userId = :targetUserId
          and cu1.chat.chatType = :chatType
        """)
    ChatEntity findPersonalChatBetween(
            @Param("currentUserId") UUID currentUserId,
            @Param("targetUserId") UUID targetUserId,
            @Param("chatType") ChatType chatType
    );

    @Query("""
        select cu.userId
        from ChatUserEntity cu
        left join UsersBlackListEntity ub
            on ub.chat.chatId = cu.chat.chatId
           and ub.userTarget = cu.userId
        where cu.chat.chatId = :chatId
          and ub.id is null
    """)
    List<UUID> findAllUserIdNotBlocksByChatId(@Param("chatId") Long chatId);

    @Query("""
        select cu.userId
        from ChatUserEntity cu
        where cu.chat.chatId = :chatId
    """)
    List<UUID> findAllUserIdsByChatId(@Param("chatId") Long chatId);

    @Query("""
        select cu
        from ChatUserEntity cu
        left join UsersBlackListEntity ub
            on ub.chat.chatId = cu.chat.chatId
           and ub.userTarget = cu.userId
        where cu.chat.chatId = :chatId
          and ub.id is null
    """)
    List<ChatUserEntity> findAllNotBlocksByChatId(@Param("chatId") Long chatId);

    @Query("""
            SELECT cu from ChatUserEntity cu
            where cu.chat.chatId = :chatId
            and cu.userId = :userId
            """)
    ChatUserEntity findByUserIdAndChatId(@Param("chatId") Long chatId, @Param("userId") UUID userId);


}
