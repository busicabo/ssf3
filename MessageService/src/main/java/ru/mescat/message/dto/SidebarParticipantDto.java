package ru.mescat.message.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.util.UUID;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@ToString
public class SidebarParticipantDto {
    private UUID userId;
    private String username;
    private String avatarUrl;
    private boolean online;
}
