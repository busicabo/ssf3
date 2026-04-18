package ru.mescat.client.websocket;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import ru.mescat.client.dto.ApiResponse;
import ru.mescat.client.dto.MessageDto;
import ru.mescat.client.service.MessageServiceProxy;

import java.time.OffsetDateTime;
import java.util.UUID;

@Controller
public class WebSocketController {

    private final MessageServiceProxy proxy;
    private final WebSocketService webSocketService;

    public WebSocketController(MessageServiceProxy proxy, WebSocketService webSocketService) {
        this.proxy = proxy;
        this.webSocketService = webSocketService;
    }

    @MessageMapping("/send.chat")
    public void sendMessageToGroupChat(@Payload MessageDto newMessageDto, Authentication authentication) {
        UUID userId = UUID.fromString(authentication.getName());
        var result = proxy.post("/api/sendMessage", userId, newMessageDto);

        if (!result.getStatusCode().is2xxSuccessful()) {
            webSocketService.sendToUser(
                    userId,
                    new ApiResponse(1, String.valueOf(result.getBody()), false, OffsetDateTime.now())
            );
        }
    }
}
