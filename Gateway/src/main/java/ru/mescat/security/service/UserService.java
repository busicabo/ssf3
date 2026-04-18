package ru.mescat.security.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import ru.mescat.security.User;
import ru.mescat.security.dto.RegDto;
import ru.mescat.security.exception.RemoteServiceException;

import java.util.UUID;

@Service
@Slf4j
public class UserService {

    private final RestClient restClient;

    public UserService(@Qualifier("user") RestClient restClient){
        this.restClient=restClient;
    }

    public User registration(RegDto regDto){
        try{
            User user = restClient.post()
                    .uri("/auth/reg")
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(regDto)
                    .retrieve()
                    .body(User.class);

            if (user != null) {
                log.info("UserService: пользователь зарегистрирован, userId={}, username={}", user.getId(), user.getUsername());
            }
            return user;
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            String message = e.getResponseBodyAsString();
            log.warn("UserService: ошибка регистрации, status={}, username={}", status, regDto.getUsername());
            throw new RemoteServiceException(status, message);
        } catch (RestClientException e) {
            log.error("UserService недоступен при регистрации: username={}, error={}", regDto.getUsername(), e.getMessage());
            throw new RemoteServiceException(503, "UserService unavailable: " + e.getMessage());
        }
    }

    public User info(String username){
        try{
            User user = restClient.get()
                    .uri("/auth/info/{username}",username)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(User.class);

            if (user == null) {
                log.warn("UserService: пользователь не найден по username={}", username);
            }
            return user;
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            String message = e.getResponseBodyAsString();
            log.warn("UserService: ошибка получения пользователя по username, status={}, username={}", status, username);
            throw new RemoteServiceException(status, message);
        } catch (RestClientException e) {
            log.error("UserService недоступен при info(username): username={}, error={}", username, e.getMessage());
            throw new RemoteServiceException(503, "UserService unavailable: " + e.getMessage());
        }
    }

    public User infoById(UUID id){
        try{
            User user = restClient.get()
                    .uri("/auth/info/id/{id}", id)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(User.class);

            if (user == null) {
                log.warn("UserService: пользователь не найден по id={}", id);
            }
            return user;
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            String message = e.getResponseBodyAsString();
            log.warn("UserService: ошибка получения пользователя по id, status={}, userId={}", status, id);
            throw new RemoteServiceException(status, message);
        } catch (RestClientException e) {
            log.error("UserService недоступен при infoById: userId={}, error={}", id, e.getMessage());
            throw new RemoteServiceException(503, "UserService unavailable: " + e.getMessage());
        }
    }
}
