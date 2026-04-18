package ru.mescat.client.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import ru.mescat.client.service.MessageServiceProxy;

import java.util.UUID;

@RestController
@RequestMapping("/api")
public class UserController {

    private final MessageServiceProxy proxy;

    public UserController(MessageServiceProxy proxy) {
        this.proxy = proxy;
    }

    @GetMapping("/{username}/getId")
    public ResponseEntity<?> getIdByUsername(@PathVariable String username) {
        return proxy.getWithoutUserHeader("/api/" + username + "/getId");
    }

    @GetMapping("/search_by_username")
    public ResponseEntity<?> searchByUsername(@RequestParam String username,
                                              Authentication authentication) {
        return proxy.get("/api/search_by_username?username=" + username, userId(authentication));
    }

    private UUID userId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
