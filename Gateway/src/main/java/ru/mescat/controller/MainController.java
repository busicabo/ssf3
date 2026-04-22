package ru.mescat.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class MainController {

    @GetMapping("/")
    public String get() {
        return "redirect:/message";
    }

    @GetMapping("/auth/login")
    public String login() {
        return "auth";
    }

    @GetMapping("/auth/reg")
    public String reg() {
        return "reg";
    }
}
