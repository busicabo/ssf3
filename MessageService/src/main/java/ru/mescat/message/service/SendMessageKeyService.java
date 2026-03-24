package ru.mescat.message.service;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.mescat.message.dto.RequestEncryptMessageKeyForUser;
import ru.mescat.message.dto.ResponseEncryptMessageKeyForUser;
import ru.mescat.message.dto.SendEncryptKeyDto;
import ru.mescat.message.dto.kafka.KeyDelete;
import ru.mescat.message.entity.SendMessageKeyEntity;
import ru.mescat.message.exception.ChatNotFoundException;
import ru.mescat.message.exception.NotFoundException;
import ru.mescat.message.exception.SaveToDatabaseException;
import ru.mescat.message.exception.UserBlockedException;
import ru.mescat.message.repository.SendMessageKeyRepository;
import ru.mescat.message.websocket.WebSocketService;
import tools.jackson.databind.ObjectMapper;

import java.util.*;

@Service
@Transactional(readOnly = true)
public class SendMessageKeyService {

    private final SendMessageKeyRepository sendMessageKeyRepository;
    private final WebSocketService webSocketService;
    private final ChatUserService chatUserService;
    private final UsersBlackListService usersBlackListService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public SendMessageKeyService(SendMessageKeyRepository sendMessageKeyRepository,
                                 WebSocketService webSocketService,
                                 ChatUserService chatUserService,
                                 UsersBlackListService usersBlackListService) {
        this.usersBlackListService=usersBlackListService;
        this.chatUserService=chatUserService;
        this.webSocketService=webSocketService;
        this.sendMessageKeyRepository = sendMessageKeyRepository;
    }

    @Transactional
    public SendMessageKeyEntity save(SendMessageKeyEntity entity) {
        return sendMessageKeyRepository.save(entity);
    }

    @Transactional
    public List<SendMessageKeyEntity> saveAll(List<SendMessageKeyEntity> entities) {
        return sendMessageKeyRepository.saveAll(entities);
    }

    public SendMessageKeyEntity findById(UUID id) {
        return sendMessageKeyRepository.findById(id).orElse(null);
    }

    public List<SendMessageKeyEntity> findAll() {
        return sendMessageKeyRepository.findAll();
    }

    public List<SendMessageKeyEntity> findAllByUserId(UUID userId) {
        return sendMessageKeyRepository.findAllByUserId(userId);
    }

    public List<SendMessageKeyEntity> findAllByUserTargetId(UUID userTargetId) {
        return sendMessageKeyRepository.findAllByUserTargetId(userTargetId);
    }

    public SendMessageKeyEntity findByUserIdAndUserTargetId(UUID userId, UUID userTargetId) {
        return sendMessageKeyRepository.findByUserIdAndUserTargetId(userId, userTargetId).orElse(null);
    }

    public List<SendMessageKeyEntity> findAllByPublicKey(UUID publicKey) {
        return sendMessageKeyRepository.findAllByPublicKey(publicKey);
    }

    public boolean existsByUserIdAndUserTargetId(UUID userId, UUID userTargetId) {
        return sendMessageKeyRepository.existsByUserIdAndUserTargetId(userId, userTargetId);
    }

    @Transactional
    public void deleteById(UUID id) {
        sendMessageKeyRepository.deleteById(id);
    }

    @Transactional
    public void deleteByUserIdAndUserTargetId(UUID userId, UUID userTargetId) {
        sendMessageKeyRepository.deleteByUserIdAndUserTargetId(userId, userTargetId);
    }

    @Transactional
    public void deleteAllById(List<KeyDelete> keyDeletes){
        sendMessageKeyRepository.deleteAllById(keyDeletes.stream().map(k -> k.getKeyId()).toList());
    }

    public void sendEncryptKey(SendEncryptKeyDto sendEncryptKeyDto){
        UUID userId = UUID.fromString(SecurityContextHolder.getContext().getAuthentication().getName());
        if(!chatUserService.existsByChatIdAndUserId(sendEncryptKeyDto.getChatId(),userId)) {
            throw new NotFoundException("Группа не найдена.");
        };

        if(usersBlackListService.isBlockedInChat(sendEncryptKeyDto.getChatId(),userId)){
            throw new UserBlockedException("Пользователь заблокирован в данной группе.");
        }

        sendEncryptKeyDto.setEncryptName(UUID.randomUUID());
        List<UUID> userIds = chatUserService.findAllUserIdNotBlocksByChatId(sendEncryptKeyDto.getChatId());

        Set<UUID> userIdsSet = new HashSet<>(userIds);
        List<RequestEncryptMessageKeyForUser> verifiedUsers = sendEncryptKeyDto.getRequestEncryptMessageKeyForUsers();

        Iterator<RequestEncryptMessageKeyForUser> iterator = verifiedUsers.iterator();

        while(iterator.hasNext()){
            RequestEncryptMessageKeyForUser r = iterator.next();

            if(!userIdsSet.contains(r.getUserTarget())){
                verifiedUsers.remove(r);
            }
        }

        List<SendMessageKeyEntity> sendMessageKeyEntities = saveAll(verifiedUsers.stream().map(v -> new SendMessageKeyEntity(
                userId,v.getKey(),v.getPublicKeyUser(),v.getUserTarget()
        )).toList());

        if(sendMessageKeyEntities==null){
            throw new SaveToDatabaseException("Не удалось сохранить в бд!");
        }

        for(SendMessageKeyEntity m: sendMessageKeyEntities){
            webSocketService.sendJson(objectMapper.writeValueAsString(new ResponseEncryptMessageKeyForUser(
                    m.getUserTargetId(),m.getKey(),m.getEncryptName(),m.getPublicKey()
            )),m.getUserTargetId());

        }


    }

}