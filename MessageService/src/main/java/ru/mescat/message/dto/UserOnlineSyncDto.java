package ru.mescat.message.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import ru.mescat.keyvault.dto.NewPrivateKeyEntity;
import ru.mescat.keyvault.dto.PublicKey;

import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class UserOnlineSyncDto {
    private UUID userId;
    private List<ChatDto> chats;
    private List<MessageForUser> messages;
    private List<PendingMessageKeyDto> pendingMessageKeys;
    private NewPrivateKeyEntity newPrivateKey;
    private PublicKey publicKey;
}

