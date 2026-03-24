package ru.mescat.keyvault.service;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import ru.mescat.keyvault.dto.PublicKey;
import ru.mescat.keyvault.dto.SaveDto;
import ru.mescat.message.exception.RemoteServiceException;

import java.util.List;
import java.util.UUID;

@Service
public class KeyVaultService {

    private RestClient restClient;

    public KeyVaultService(@Qualifier("key_vault") RestClient restClient){
        this.restClient = restClient;
    }

    public Integer getActiveCountPublicKey(String id){
        try{
            Integer count = restClient.get()
                    .uri("/api/public_keys/count/{id}", id)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(Integer.class);
            return count;
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            String message = e.getResponseBodyAsString();

            throw new RemoteServiceException(status, message);
        } catch (RestClientException e) {
            throw new RemoteServiceException(503, "UserService unavailable: " + e.getMessage());
        }
    }

    public List<PublicKey> getKeys(String id){
        try{
            List<PublicKey> keys = restClient.get()
                    .uri("/api/public_keys/{id}", id)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(new ParameterizedTypeReference<List<PublicKey>>() {
                    });
            return keys;
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            String message = e.getResponseBodyAsString();

            throw new RemoteServiceException(status, message);
        } catch (RestClientException e) {
            throw new RemoteServiceException(503, "UserService unavailable: " + e.getMessage());
        }
    }

    public List<PublicKey> getKeys(List<UUID> ids){
        try{
            List<PublicKey> keys = restClient.post()
                    .uri("/api/public_keys")
                    .body(ids)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(new ParameterizedTypeReference<List<PublicKey>>() {
                    });
            return keys;
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            String message = e.getResponseBodyAsString();

            throw new RemoteServiceException(status, message);
        } catch (RestClientException e) {
            throw new RemoteServiceException(503, "UserService unavailable: " + e.getMessage());
        }
    }

    public PublicKey saveKey(SaveDto saveDto){
        try{
            PublicKey key = restClient.post()
                    .uri("/api/public_keys/save")
                    .body(saveDto)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(PublicKey.class);
            return key;
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            String message = e.getResponseBodyAsString();

            throw new RemoteServiceException(status, message);
        } catch (RestClientException e) {
            throw new RemoteServiceException(503, "UserService unavailable: " + e.getMessage());
        }
    }

    public void deleteKeyById(String keyId){
        try{
            restClient.post()
                    .uri("/api/public_keys/delete")
                    .body(keyId)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            String message = e.getResponseBodyAsString();

            throw new RemoteServiceException(status, message);
        } catch (RestClientException e) {
            throw new RemoteServiceException(503, "UserService unavailable: " + e.getMessage());
        }
    }


}
