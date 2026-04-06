package ru.mescat.client.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.mescat.message.dto.SendEncryptKeyDto;
import ru.mescat.message.exception.ChatNotFoundException;
import ru.mescat.message.exception.SaveToDatabaseException;
import ru.mescat.message.exception.UserBlockedException;
import ru.mescat.message.service.DeleteSentKeysService;
import ru.mescat.message.service.SendMessageKeyService;

import java.util.UUID;

@RestController
@RequestMapping("/api/encrypt_message_key")
public class EncryptMessageKeyController {

    private DeleteSentKeysService deleteSentKeysService;
    private SendMessageKeyService sendMessageKeyService;

    public EncryptMessageKeyController(DeleteSentKeysService deleteSentKeysService,
                                       SendMessageKeyService sendMessageKeyService){
        this.sendMessageKeyService=sendMessageKeyService;
        this.deleteSentKeysService=deleteSentKeysService;
    }

    @PostMapping("/delete")
    public ResponseEntity<?> addNewKey(@RequestBody UUID id){
        try{
            deleteSentKeysService.addKeyInQueue(id);
            return ResponseEntity.ok().build();
        } catch (Exception e){
            return ResponseEntity.status(500).build();
        }
    }

    @PostMapping("/send")
    public ResponseEntity<?> sendKeys(@RequestBody SendEncryptKeyDto sendEncryptKeyDtos){
        try{
            sendMessageKeyService.sendEncryptKey(sendEncryptKeyDtos);
            return ResponseEntity.ok().build();
        } catch (SaveToDatabaseException e){
            return ResponseEntity.status(500).body(e.getMessage());
        } catch (ChatNotFoundException e){
            return ResponseEntity.status(404).body(e.getMessage());
        } catch (UserBlockedException e){
            return ResponseEntity.status(403).body(e.getMessage());
        }
    }

    @GetMapping

}
