package ru.mescat.client.websocket;

import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@Slf4j
public class WebSocketService {

    private final SimpMessagingTemplate template;

    public WebSocketService(SimpMessagingTemplate template) {
        this.template = template;
    }

    public void sendToUser(UUID userId, Object payload) {
        template.convertAndSendToUser(userId.toString(), "/queue/events", payload);
        log.debug("WebSocket событие отправлено пользователю: userId={}", userId);
    }

    public void sendToChat(Long chatId, Object payload) {
        template.convertAndSend("/topic/chat/" + chatId, payload);
        log.debug("WebSocket событие отправлено в чат: chatId={}", chatId);
    }
}
