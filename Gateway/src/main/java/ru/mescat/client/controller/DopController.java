package ru.mescat.client.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.UUID;

@Controller
@RequestMapping
public class DopController {

    @GetMapping("/message")
    public String message() {
        return "redirect:/chat.html";
    }

    @GetMapping("/api/getId")
    public ResponseEntity<UUID> getId(Authentication authentication) {
        return ResponseEntity.ok(UUID.fromString(authentication.getName()));
    }
}
