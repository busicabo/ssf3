package ru.mescat.message.websocket;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import ru.mescat.message.dto.ApiResponse;
import ru.mescat.message.dto.MessageDto;
import ru.mescat.message.entity.MessageEntity;
import ru.mescat.message.exception.RemoteServiceException;
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
    public void sendMessageToGroupChat(@Payload MessageDto newMessageDto, Authentication authentication) {

        MessageEntity message;
        try{
            message = webSocketService.newMessageDtoConvertToMessageEntity(newMessageDto);
            message.setSenderId(UUID.fromString(authentication.getName()));
            messageService.sendMessage(message);
        } catch (RemoteServiceException e){
            webSocketService.sendNotification(new ApiResponse(e.getStatus(),e.getMessage(),false,
                    OffsetDateTime.now()),UUID.fromString(authentication.getName()));
        }
    }

}
