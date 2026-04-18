package ru.mescat.message.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.mescat.message.dto.ChatDto;
import ru.mescat.message.dto.CreateGroupChatDto;
import ru.mescat.message.entity.ChatEntity;
import ru.mescat.message.entity.ChatUserEntity;
import ru.mescat.message.entity.enums.ChatType;
import ru.mescat.message.event.dto.DeleteChat;
import ru.mescat.message.exception.AccessDeniedException;
import ru.mescat.message.exception.ChatNotFoundException;
import ru.mescat.message.exception.DataBaseException;
import ru.mescat.message.repository.ChatRepository;
import ru.mescat.message.repository.ChatUserRepository;

import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class ChatService {
    private ChatRepository repository;
    private ChatUserRepository chatUserRepository;
    private ApplicationEventPublisher applicationEventPublisher;

    public ChatService(ChatRepository repository,
                       ChatUserRepository chatUserRepository,
                       ApplicationEventPublisher applicationEventPublisher){
        this.applicationEventPublisher=applicationEventPublisher;
        this.chatUserRepository =chatUserRepository;
        this.repository=repository;
    }


    public ChatEntity save(ChatEntity chat) {
        return repository.save(chat);
    }

    public ChatEntity findById(Long chatId) {
        return repository.findById(chatId).orElse(null);
    }

    public List<ChatEntity> findAll() {
        return repository.findAll();
    }

    public boolean existsById(Long chatId) {
        return repository.existsById(chatId);
    }

    public void deleteById(Long chatId) {
        repository.deleteById(chatId);
    }

    public ChatEntity findPersonalChatBetween(UUID currentUserId, UUID targetUserId){
        return repository.findPersonalChatBetween(currentUserId,targetUserId, ChatType.PERSONAL);
    }

    @Transactional
    public ChatDto createGroupChat(UUID userId, CreateGroupChatDto dto){
        log.info("Запрос на создание группового чата: creatorId={}, title={}", userId, dto.getTitle());

        ChatEntity chat = save(new ChatEntity(ChatType.GROUP,dto.getTitle(),dto.getAvatarUrl()));

        if(chat==null){
            log.error("Не удалось сохранить групповой чат в БД: creatorId={}", userId);
            throw new DataBaseException("Не удалось сохранить чат.");
        }
        ChatUserEntity chatUserEntity = chatUserRepository.save(new ChatUserEntity(chat,userId,"CREATOR"));

        if(chatUserEntity==null){
            log.error("Не удалось добавить создателя в групповой чат: creatorId={}, chatId={}", userId, chat.getChatId());
            throw new DataBaseException("Не удалось добавить пользователя.");
        }

        log.info("Групповой чат создан: chatId={}, creatorId={}", chat.getChatId(), userId);
        return new ChatDto(chat.getChatId(),chat.getChatType(),chat.getTitle(),chat.getAvatarUrl());
    }

    @Transactional
    public void deleteChatById(Long chatId, UUID userId){
        log.info("Запрос на удаление чата: chatId={}, userId={}", chatId, userId);

        ChatUserEntity chatUserEntity = chatUserRepository.findByUserIdAndChatId(chatId,userId);

        if(chatUserEntity==null){
            log.warn("Удаление чата отклонено: чат не найден для пользователя. chatId={}, userId={}", chatId, userId);
            throw new ChatNotFoundException("Чат не найден.");
        }

        if(!chatUserEntity.getRole().equals("CREATOR")){
            log.warn("Удаление чата отклонено: пользователь не является создателем. chatId={}, userId={}, role={}",
                    chatId, userId, chatUserEntity.getRole());
            throw new AccessDeniedException("Удалить группу может только ее создатель.");
        }

        deleteById(chatId);

        applicationEventPublisher.publishEvent(new DeleteChat(chatUserEntity.getChat()));
        log.info("Чат удален: chatId={}, deletedBy={}", chatId, userId);
    }
}
