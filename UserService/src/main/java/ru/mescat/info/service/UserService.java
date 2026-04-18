package ru.mescat.info.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.mescat.info.entity.UserEntity;
import ru.mescat.info.repository.UserRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Slf4j
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder){
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public UserEntity save(UserEntity user){
        return userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public Optional<UserEntity> findById(UUID id){
        return userRepository.findById(id);
    }

    public void delete(UUID id){
        userRepository.deleteById(id);
        log.info("Пользователь удален: userId={}", id);
    }

    @Transactional(readOnly = true)
    public Optional<UserEntity> searchByUsername(String username){
        return userRepository.findByUsername(username);
    }

    @Transactional(readOnly = true)
    public List<UserEntity> findByUsernameContaining(String x){
        return userRepository.findByUsernameContainingIgnoreCase(x);
    }

    public boolean updatePassword(UUID userId, String password){
        boolean updated = userRepository.updatePasswordById(userId, passwordEncoder.encode(password)) == 1;
        log.info("Обновление пароля: userId={}, updated={}", userId, updated);
        return updated;
    }

    public boolean updateBlocked(UUID userId, boolean blocked){
        boolean updated = userRepository.updateBlockedById(userId, blocked) == 1;
        log.info("Обновление статуса блокировки: userId={}, blocked={}, updated={}", userId, blocked, updated);
        return updated;
    }

    public boolean updateOnline(UUID userId, boolean online){
        boolean updated = userRepository.updateOnlineById(userId, online) == 1;
        log.info("Обновление статуса online: userId={}, online={}, updated={}", userId, online, updated);
        return updated;
    }

    public List<UserEntity> findAllByIds(List<UUID> userIds){
        return userRepository.findAllById(userIds);
    }

    public boolean updateUsername(UUID userId, String username){
        boolean updated = userRepository.updateUsernameById(userId, username) == 1;
        log.info("Обновление username: userId={}, newUsername={}, updated={}", userId, username, updated);
        return updated;
    }

    public UserEntity findByUsername(String username){
        return userRepository.findByUsername(username).orElse(null);
    }

    public UUID getIdByUsername(String username){
        return userRepository.getIdByUsername(username);
    }

    public UserEntity createNewUser(String username, String password){
        UserEntity entity = new UserEntity(
                username,
                passwordEncoder.encode(password)
        );

        UserEntity saved = save(entity);
        if (saved != null) {
            log.info("Создан новый пользователь: userId={}, username={}", saved.getId(), saved.getUsername());
        }
        return saved;
    }
}
