package ru.mescat.client.websocket;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import ru.mescat.client.dto.kafka.UserOnlineEvent;

import java.time.OffsetDateTime;
import java.util.UUID;

@Component
@Slf4j
public class UserOnlinePublisher {

    private final KafkaTemplate<String, UserOnlineEvent> kafkaTemplate;
    private final String topic;

    public UserOnlinePublisher(@Qualifier("kafkaTemplateUserOnline") KafkaTemplate<String, UserOnlineEvent> kafkaTemplate,
                               @Value("${spring.kafka.user-online.topic}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
    }

    @EventListener
    public void onConnected(SessionConnectedEvent event) {
        publish(event, true);
    }

    @EventListener
    public void onDisconnected(SessionDisconnectEvent event) {
        publish(event, false);
    }

    private void publish(Object sourceEvent, boolean online) {
        StompHeaderAccessor accessor;
        if (sourceEvent instanceof SessionConnectedEvent connectedEvent) {
            accessor = StompHeaderAccessor.wrap(connectedEvent.getMessage());
        } else if (sourceEvent instanceof SessionDisconnectEvent disconnectEvent) {
            accessor = StompHeaderAccessor.wrap(disconnectEvent.getMessage());
        } else {
            return;
        }

        if (!(accessor.getUser() instanceof Authentication authentication)) {
            return;
        }

        try {
            UUID userId = UUID.fromString(authentication.getName());
            kafkaTemplate.send(topic, new UserOnlineEvent(userId, online, OffsetDateTime.now().toString()));
            log.info("Отправлено событие user-online: userId={}, online={}", userId, online);
        } catch (Exception e) {
            log.warn("Не удалось отправить событие user-online: error={}", e.getMessage());
        }
    }
}