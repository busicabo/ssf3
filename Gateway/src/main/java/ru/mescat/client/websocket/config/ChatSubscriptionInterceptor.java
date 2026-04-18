package ru.mescat.client.websocket.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class ChatSubscriptionInterceptor implements ChannelInterceptor {

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            String destination = accessor.getDestination();
            if (destination != null && destination.startsWith("/topic/chat/")) {
                String chatIdPart = destination.substring("/topic/chat/".length());
                try {
                    Long.parseLong(chatIdPart);
                } catch (NumberFormatException e) {
                    log.warn("Отклонена подписка WebSocket: некорректный destination={}", destination);
                    throw new IllegalArgumentException("Invalid chat destination: " + destination);
                }
            }
        }

        return message;
    }
}
