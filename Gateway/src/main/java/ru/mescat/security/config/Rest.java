package ru.mescat.security.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class Rest {

    @Value("${services.user.base-url:http://localhost:8081}")
    private String userServiceBaseUrl;

    @Value("${services.message.base-url:http://localhost:8082}")
    private String messageServiceBaseUrl;

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

    @Bean("message")
    public RestClient messageServiceRestClient(RestClient.Builder builder) {
        return builder
                .baseUrl(messageServiceBaseUrl)
                .build();
    }
}
