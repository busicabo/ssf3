package ru.mescat.message.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import ru.mescat.keyvault.dto.NewPrivateKeyEntity;
import ru.mescat.keyvault.dto.PublicKey;
import ru.mescat.keyvault.service.KeyVaultService;
import ru.mescat.message.dto.ChatDto;
import ru.mescat.message.dto.MessageForUser;
import ru.mescat.message.dto.PendingMessageKeyDto;
import ru.mescat.message.dto.kafka.MessageEventDto;
import ru.mescat.message.dto.kafka.MessageEventType;
import ru.mescat.message.dto.kafka.UserOnlineEvent;
import ru.mescat.message.exception.RemoteServiceException;
import ru.mescat.user.service.UserService;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class UserOnlineSyncService {

    private static final int MESSAGE_SYNC_LIMIT = 100;

    private final ChatQueryService chatQueryService;
    private final MessageService messageService;
    private final SendMessageKeyService sendMessageKeyService;
    private final NewPrivateKeyService newPrivateKeyService;
    private final KeyVaultService keyVaultService;
    private final UserService userService;
    private final KafkaTemplate<String, MessageEventDto> kafkaTemplate;
    private final String topic;

    public UserOnlineSyncService(ChatQueryService chatQueryService,
                                 MessageService messageService,
                                 SendMessageKeyService sendMessageKeyService,
                                 NewPrivateKeyService newPrivateKeyService,
                                 KeyVaultService keyVaultService,
                                 UserService userService,
                                 @Qualifier("kafkaTemplateMessage") KafkaTemplate<String, MessageEventDto> kafkaTemplate,
                                 @Value("${spring.kafka.message.topic}") String topic) {
        this.chatQueryService = chatQueryService;
        this.messageService = messageService;
        this.sendMessageKeyService = sendMessageKeyService;
        this.newPrivateKeyService = newPrivateKeyService;
        this.keyVaultService = keyVaultService;
        this.userService = userService;
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
    }

    @KafkaListener(topics = "${spring.kafka.user-online.topic}", containerFactory = "kafkaListenerUserOnline")
    public void onUserOnline(UserOnlineEvent event) {
        if (event == null || event.getUserId() == null) {
            return;
        }

        try {
            userService.updateOnline(event.getUserId(), event.isOnline());
        } catch (Exception e) {
            log.warn("Не удалось обновить online-статус пользователя: userId={}, error={}", event.getUserId(), e.getMessage());
        }

        if (!event.isOnline()) {
            return;
        }

        List<ChatDto> chats = safeChats(event.getUserId());
        List<MessageForUser> messages = safeMessages(event.getUserId());
        List<PendingMessageKeyDto> pendingKeys = sendMessageKeyService.getPendingKeysForUser(event.getUserId());
        NewPrivateKeyEntity newPrivateKey = safeNewPrivateKey(event.getUserId());
        PublicKey publicKey = safePublicKey(event.getUserId());

        Map<String, Object> payload = buildSyncPayload(event.getUserId(), chats, messages, pendingKeys, newPrivateKey, publicKey);

        kafkaTemplate.send(topic, new MessageEventDto(MessageEventType.USER_SYNC, payload));
        log.info("Отправлен user-sync пакет: userId={}, chats={}, messages={}, pendingKeys={}",
                event.getUserId(), chats.size(), messages.size(), pendingKeys.size());
    }

    private List<ChatDto> safeChats(UUID userId) {
        List<ChatDto> chats = chatQueryService.getChatsForUser(userId);
        return chats == null ? List.of() : chats;
    }

    private List<MessageForUser> safeMessages(UUID userId) {
        List<MessageForUser> messages = messageService.getLastNMessagesForEachUserChatDto(userId, MESSAGE_SYNC_LIMIT);
        return messages == null ? List.of() : messages;
    }

    private NewPrivateKeyEntity safeNewPrivateKey(UUID userId) {
        try {
            return newPrivateKeyService.findAllByUserId(userId);
        } catch (RemoteServiceException e) {
            if (e.getStatus() == 404) {
                return null;
            }
            log.warn("Не удалось получить NewPrivateKey для user-sync: userId={}, status={}", userId, e.getStatus());
            return null;
        }
    }

    private PublicKey safePublicKey(UUID userId) {
        try {
            return keyVaultService.getKeyByUserId(userId.toString());
        } catch (RemoteServiceException e) {
            if (e.getStatus() == 404) {
                return null;
            }
            log.warn("Не удалось получить public key для user-sync: userId={}, status={}", userId, e.getStatus());
            return null;
        }
    }

    private Map<String, Object> buildSyncPayload(UUID userId,
                                                 List<ChatDto> chats,
                                                 List<MessageForUser> messages,
                                                 List<PendingMessageKeyDto> pendingKeys,
                                                 NewPrivateKeyEntity newPrivateKey,
                                                 PublicKey publicKey) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("userId", userId);

        List<Map<String, Object>> chatNodes = new ArrayList<>();
        for (ChatDto chat : chats) {
            if (chat == null) {
                continue;
            }
            Map<String, Object> node = new HashMap<>();
            node.put("chatId", chat.getChatId());
            node.put("chatType", chat.getChatType() != null ? chat.getChatType().name() : null);
            node.put("title", chat.getTitle());
            node.put("avatarUrl", chat.getAvatarUrl());
            node.put("lastMessage", chat.getLastMessage());
            node.put("encryptName", chat.getEncryptName());
            chatNodes.add(node);
        }
        payload.put("chats", chatNodes);

        List<Map<String, Object>> messageNodes = new ArrayList<>();
        for (MessageForUser message : messages) {
            if (message == null) {
                continue;
            }
            Map<String, Object> node = new HashMap<>();
            node.put("messageId", message.getMessageId());
            node.put("chatId", message.getChatId());
            node.put("message", message.getMessage());
            node.put("encryptionName", message.getEncryptionName());
            node.put("senderId", message.getSenderId());
            node.put("createdAt", message.getCreatedAt() != null ? message.getCreatedAt().toString() : null);
            messageNodes.add(node);
        }
        payload.put("messages", messageNodes);

        List<Map<String, Object>> keyNodes = new ArrayList<>();
        for (PendingMessageKeyDto key : pendingKeys) {
            if (key == null) {
                continue;
            }
            Map<String, Object> node = new HashMap<>();
            node.put("id", key.getId());
            node.put("userId", key.getUserId());
            node.put("userTargetId", key.getUserTargetId());
            node.put("key", key.getKey());
            node.put("publicKey", key.getPublicKey());
            node.put("encryptName", key.getEncryptName());
            node.put("sendAt", key.getSendAt() != null ? key.getSendAt().toString() : null);
            keyNodes.add(node);
        }
        payload.put("pendingMessageKeys", keyNodes);

        if (newPrivateKey != null) {
            Map<String, Object> privateKeyNode = new HashMap<>();
            privateKeyNode.put("id", newPrivateKey.getId());
            privateKeyNode.put("userId", newPrivateKey.getUserId());
            privateKeyNode.put("key", newPrivateKey.getKey());
            privateKeyNode.put("createdAt", newPrivateKey.getCreatedAt() != null ? newPrivateKey.getCreatedAt().toString() : null);
            privateKeyNode.put("publicKey", newPrivateKey.getPublicKey());
            privateKeyNode.put("encryptingPublicKey", newPrivateKey.getEncryptingPublicKey());
            payload.put("newPrivateKey", privateKeyNode);
        } else {
            payload.put("newPrivateKey", null);
        }

        if (publicKey != null) {
            Map<String, Object> publicKeyNode = new HashMap<>();
            publicKeyNode.put("id", publicKey.getId());
            publicKeyNode.put("userId", publicKey.getUserId());
            publicKeyNode.put("key", publicKey.getKey());
            publicKeyNode.put("createdAt", publicKey.getCreatedAt() != null ? publicKey.getCreatedAt().toString() : null);
            payload.put("publicKey", publicKeyNode);
        } else {
            payload.put("publicKey", null);
        }

        return payload;
    }
}