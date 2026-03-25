package ru.mescat.message.websocket;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import ru.mescat.message.dto.ApiResponse;
import ru.mescat.message.dto.MessageDto;
import ru.mescat.message.entity.MessageEntity;
import ru.mescat.message.exception.*;
import ru.mescat.message.service.ChatService;
import ru.mescat.message.service.MessageService;

import java.time.OffsetDateTime;
import java.util.UUID;

@Controller
public class WebSocketController {

    private final SimpMessagingTemplate template;
    private WebSocketService webSocketService;
    private ChatService chatService;
    private MessageService messageService;

    public WebSocketController(SimpMessagingTemplate template, WebSocketService webSocketService,MessageService messageService) {
        this.messageService=messageService;
        this.webSocketService=webSocketService;
        this.template = template;
    }

    @MessageMapping("/send.chat")
    public void sendMessageToGroupChat(@Payload MessageDto newMessageDto) {
        UUID userId = UUID.fromString(SecurityContextHolder.getContext().getAuthentication().getName());
        try{
            messageService.sendMessage(newMessageDto);
        } catch (ChatNotFoundException | UserBlockedException | SaveToDatabaseException | DataBaseException e){
            webSocketService.sendNotification(new ApiResponse(1,e.getMessage(),
                    false,OffsetDateTime.now()),userId);
        } catch (Exception e){
            webSocketService.sendNotification(new ApiResponse(1,"Произошла неизвестная ошибка.",
                    false,OffsetDateTime.now()),userId);
        }
    }

}
