package ru.mescat.security;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.time.OffsetDateTime;
import java.util.UUID;

@Setter
@Getter
@ToString
@NoArgsConstructor
@AllArgsConstructor
public class UserSettings {
    private UUID user_id;
    private OffsetDateTime autoDeleteMessage;
    private boolean allowWriting;
    private boolean allowAddChat;
}
