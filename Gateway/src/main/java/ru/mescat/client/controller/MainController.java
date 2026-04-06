package ru.mescat.client.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.UUID;

@Controller
public class MainController {
    @GetMapping("/message")
    public String message(){
        return "chat";
    }

    @GetMapping("/getId")
    public ResponseEntity<UUID> getId(Authentication authentication){
        return ResponseEntity.ok(UUID.fromString(authentication.getName()));
    }
}
