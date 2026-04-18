package ru.mescat.message.event.listener;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import ru.mescat.keyvault.dto.NewPrivateKeyEntity;
import ru.mescat.keyvault.dto.PublicKey;
import ru.mescat.message.dto.MessageKeyForUser;
import ru.mescat.message.dto.kafka.EncryptKeyEventDto;
import ru.mescat.message.dto.kafka.EncryptKeyType;
import ru.mescat.message.event.dto.NewMessageKey;
import ru.mescat.message.event.dto.NewPrivateKey;
import ru.mescat.message.event.dto.NewPublicKey;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
@Slf4j
public class EncryptKeyEvent {

    private final KafkaTemplate<String, EncryptKeyEventDto> kafkaTemplate;
    private final String topic;

    public EncryptKeyEvent(@Qualifier("kafkaTemplateEncryptKey") KafkaTemplate<String, EncryptKeyEventDto> kafkaTemplate,
                           @Value("${spring.kafka.encrypt-keys.topic}") String topic) {
        this.topic = topic;
        this.kafkaTemplate = kafkaTemplate;
    }

    @TransactionalEventListener
    public void newMessageKey(NewMessageKey event) {
        kafkaTemplate.send(topic, new EncryptKeyEventDto(EncryptKeyType.NEW_MESSAGE_KEY, newMessageKeysPayload(event)));
        log.debug("Событие нового message-key отправлено в Kafka: topic={}", topic);
    }

    @TransactionalEventListener
    public void newPrivateKey(NewPrivateKey event) {
        kafkaTemplate.send(topic, new EncryptKeyEventDto(EncryptKeyType.NEW_PRIVATE_KEY, newPrivateKeyPayload(event)));
        log.debug("Событие нового private-key отправлено в Kafka: topic={}", topic);
    }

    @TransactionalEventListener
    public void newPublicKey(NewPublicKey event) {
        kafkaTemplate.send(topic, new EncryptKeyEventDto(EncryptKeyType.NEW_PUBLIC_KEY, newPublicKeyPayload(event)));
        log.debug("Событие нового public-key отправлено в Kafka: topic={}", topic);
    }

    private Map<String, Object> newMessageKeysPayload(NewMessageKey event) {
        List<Map<String, Object>> keyNodes = new ArrayList<>();

        if (event != null && event.getKeys() != null) {
            for (MessageKeyForUser key : event.getKeys()) {
                if (key == null) {
                    continue;
                }
                Map<String, Object> node = new HashMap<>();
                node.put("userTarget", key.getUserTarget());
                node.put("key", key.getKey());
                node.put("encryptName", key.getEncryptName());
                node.put("publicKey", key.getPublicKeyUser());
                keyNodes.add(node);
            }
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("keys", keyNodes);
        return payload;
    }

    private Map<String, Object> newPrivateKeyPayload(NewPrivateKey event) {
        Map<String, Object> payload = new HashMap<>();
        Map<String, Object> keyNode = new HashMap<>();

        NewPrivateKeyEntity key = event != null ? event.getNewPrivateKey() : null;
        if (key != null) {
            keyNode.put("id", key.getId());
            keyNode.put("userId", key.getUserId());
            keyNode.put("key", key.getKey());
            keyNode.put("createdAt", key.getCreatedAt() != null ? key.getCreatedAt().toString() : null);
            keyNode.put("publicKey", key.getPublicKey());
            keyNode.put("encryptingPublicKey", key.getEncryptingPublicKey());
        }

        payload.put("newPrivateKey", keyNode);
        return payload;
    }

    private Map<String, Object> newPublicKeyPayload(NewPublicKey event) {
        Map<String, Object> payload = new HashMap<>();
        Map<String, Object> keyNode = new HashMap<>();

        PublicKey key = event != null ? event.getPublicKey() : null;
        if (key != null) {
            keyNode.put("id", key.getId());
            keyNode.put("userId", key.getUserId());
            keyNode.put("key", key.getKey());
            keyNode.put("createdAt", key.getCreatedAt() != null ? key.getCreatedAt().toString() : null);
        }

        payload.put("publicKey", keyNode);
        return payload;
    }
}