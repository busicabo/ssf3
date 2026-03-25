package ru.mescat.message.websocket;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import ru.mescat.message.dto.ApiResponse;
import ru.mescat.message.dto.MessageDto;
import ru.mescat.message.entity.ChatEntity;
import ru.mescat.message.entity.MessageEntity;
import ru.mescat.message.exception.RemoteServiceException;
import ru.mescat.message.service.ChatService;

import java.util.UUID;

@Service
public class WebSocketService {

    private final SimpMessagingTemplate template;
    private ChatService chatService;

    public WebSocketService(SimpMessagingTemplate template, ChatService chatService) {
        this.chatService=chatService;
        this.template = template;
    }


    public void sendNotification(ApiResponse apiResponse, UUID userId){
        template.convertAndSendToUser(userId.toString(),"/queue/system", apiResponse);
    }

    public void sendJson(String json, UUID userId){
        template.convertAndSendToUser(userId.toString(),"/queue/system",json);
    }

    public void sendToTopic(String json, Long chatId){
        template.convertAndSend("/topic/chat/"+chatId.toString(),json);
    }

}
