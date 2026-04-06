package ru.mescat.client.websocket.config;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;
import ru.mescat.message.service.ChatUserService;

import java.security.Principal;
import java.util.UUID;

@Component
public class ChatSubscriptionInterceptor implements ChannelInterceptor {

    private final ChatUserService chatUserService;

    public ChatSubscriptionInterceptor(ChatUserService chatUserService) {
        this.chatUserService = chatUserService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            Principal user = accessor.getUser();
            String destination = accessor.getDestination();

            if (user == null || destination == null) {
                throw new IllegalArgumentException("Пользователь не аутентифицирован");
            }

            if (destination.startsWith("/topic/chat/")) {
                Long chatId = extractChatId(destination);
                UUID userId = UUID.fromString(user.getName());

                boolean isMember = chatUserService.existsByChatIdAndUserId(chatId, userId);

                if (!isMember) {
                    throw new RuntimeException("Нет доступа к этому чату");
                }
            }
        }

        return message;
    }

    private Long extractChatId(String destination) {
        String value = destination.substring("/topic/chat/".length());
        return Long.parseLong(value);
    }
}