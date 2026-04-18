package ru.mescat.rest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class Rest {

    @Value("${services.user.base-url:http://localhost:8081}")
    private String userServiceBaseUrl;

    @Value("${services.key-vault.base-url:http://localhost:8085}")
    private String keyVaultServiceBaseUrl;

    @Bean
    public RestClient.Builder restClientBuilder() {
        return RestClient.builder();
    }

    @Bean("user")
    public RestClient userServiceRestClient(RestClient.Builder builder) {
        return builder
                .baseUrl(userServiceBaseUrl)
                .build();
    }

    @Bean("key_vault")
    public RestClient keyvaultRestClient(RestClient.Builder builder) {
        return builder
                .baseUrl(keyVaultServiceBaseUrl)
                .build();
    }
}
