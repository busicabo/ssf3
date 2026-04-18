package ru.mescat.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.mescat.dto.NewPrivateKeyDto;
import ru.mescat.entity.NewPrivateKeyEntity;
import ru.mescat.service.NewPrivateKeyService;

import java.util.UUID;

@RestController
@RequestMapping("/api/new_private_key")
public class NewPrivateKeyController {

    private NewPrivateKeyService newPrivateKeyService;

    public NewPrivateKeyController(NewPrivateKeyService newPrivateKeyService){
        this.newPrivateKeyService=newPrivateKeyService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> findAllByUserId(@PathVariable UUID id){
        try{
            NewPrivateKeyEntity entity = newPrivateKeyService.findLatestByUserId(id);
            if (entity == null) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(entity);
        } catch (Exception e){
            return ResponseEntity.status(500).body(e.getMessage());
        }
    }

    @PostMapping("/")
    public ResponseEntity<?> save(@RequestBody NewPrivateKeyDto newPrivateKeyDto){
        if (newPrivateKeyDto == null
                || newPrivateKeyDto.getUserId() == null
                || newPrivateKeyDto.getKey() == null
                || newPrivateKeyDto.getKey().length == 0
                || newPrivateKeyDto.getPublicKey() == null
                || newPrivateKeyDto.getEncryptingPublicKey() == null) {
            return ResponseEntity.badRequest().body("Некорректные данные нового приватного ключа.");
        }

        NewPrivateKeyEntity newPrivateKeyEntity = new NewPrivateKeyEntity(
                newPrivateKeyDto.getUserId(),
                newPrivateKeyDto.getKey(),
                newPrivateKeyDto.getPublicKey(),
                newPrivateKeyDto.getEncryptingPublicKey());

        try{
            NewPrivateKeyEntity result = newPrivateKeyService.save(newPrivateKeyEntity);
            return ResponseEntity.ok(result);
        }catch (Exception e){
            return ResponseEntity.status(500).body(e.getMessage());
        }
    }
}
