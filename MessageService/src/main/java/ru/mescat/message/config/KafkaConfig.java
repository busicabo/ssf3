package ru.mescat.message.config;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.springframework.kafka.support.serializer.JsonSerializer;
import ru.mescat.message.dto.kafka.ChatEventDto;
import ru.mescat.message.dto.kafka.EncryptKeyEventDto;
import ru.mescat.message.dto.kafka.KeyDelete;
import ru.mescat.message.dto.kafka.MessageEventDto;
import ru.mescat.message.dto.kafka.UserOnlineEvent;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class KafkaConfig {

    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;
    @Value("${spring.kafka.encrypt-keys.group}")
    private String encryptKeyGroup;
    @Value("${spring.kafka.message.group}")
    private String messageServiceGroup;
    @Value("${spring.kafka.user-online.group}")
    private String userOnlineGroup;
    @Value("${spring.kafka.delete-encrypt-keys.topic}")
    private String deleteEncryptKeysTopic;
    @Value("${spring.kafka.message.topic}")
    private String messageTopic;
    @Value("${spring.kafka.chat.topic}")
    private String chatTopic;
    @Value("${spring.kafka.encrypt-keys.topic}")
    private String encryptKeysTopic;
    @Value("${spring.kafka.user-online.topic}")
    private String userOnlineTopic;

    @Bean("producerFactoryKeyDelete")
    public ProducerFactory<String, KeyDelete> producerFactoryKeyDelete() {
        Map<String, Object> props = new HashMap<>();

        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        props.put(ProducerConfig.ACKS_CONFIG, "all");
        props.put(ProducerConfig.RETRIES_CONFIG, 3);
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        props.put(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, 120000);
        props.put(ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION, 5);
        props.put(JsonSerializer.ADD_TYPE_INFO_HEADERS, false);
        return new DefaultKafkaProducerFactory<>(props);
    }

    @Bean("kafkaTemplateEncryptKeyDelete")
    public KafkaTemplate<String, KeyDelete> kafkaTemplate() {
        return new KafkaTemplate<>(producerFactoryKeyDelete());
    }

    @Bean("consumerFactoryEncryptKeyDelete")
    public ConsumerFactory<String, KeyDelete> consumerFactoryEncryptKeyDelete() {
        Map<String, Object> props = new HashMap<>();

        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, encryptKeyGroup);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
        props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 10000);
        props.put(ConsumerConfig.MAX_POLL_INTERVAL_MS_CONFIG, 300000);
        props.put(JsonDeserializer.TRUSTED_PACKAGES, "ru.mescat");
        props.put(JsonDeserializer.USE_TYPE_INFO_HEADERS, false);
        props.put(JsonDeserializer.VALUE_DEFAULT_TYPE, "ru.mescat.message.dto.kafka.KeyDelete");
        return new DefaultKafkaConsumerFactory<>(props);
    }

    @Bean("kafkaListenerEncryptKeyDelete")
    public ConcurrentKafkaListenerContainerFactory<String, KeyDelete> kafkaListenerContainerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, KeyDelete> factory =
                new ConcurrentKafkaListenerContainerFactory<>();

        factory.setConsumerFactory(consumerFactoryEncryptKeyDelete());

        factory.setBatchListener(true);

        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL);

        // пауза между poll() = 10 секунд
        factory.getContainerProperties().setIdleBetweenPolls(10_000L);

        // сколько максимум ждать данные в одном poll
        factory.getContainerProperties().setPollTimeout(3_000L);
        return factory;
    }

    @Bean("producerFactoryMessage")
    public ProducerFactory<String, MessageEventDto> producerFactoryMessage() {
        Map<String, Object> props = new HashMap<>();

        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        props.put(ProducerConfig.ACKS_CONFIG, "all");
        props.put(ProducerConfig.RETRIES_CONFIG, 3);
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        props.put(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, 120000);
        props.put(ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION, 5);
        props.put(JsonSerializer.ADD_TYPE_INFO_HEADERS, false);
        return new DefaultKafkaProducerFactory<>(props);
    }

    @Bean("kafkaTemplateMessage")
    public KafkaTemplate<String, MessageEventDto> kafkaTemplateMessage() {
        return new KafkaTemplate<>(producerFactoryMessage());
    }

    @Bean("producerFactoryChat")
    public ProducerFactory<String, ChatEventDto> producerFactoryChat() {
        Map<String, Object> props = new HashMap<>();

        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        props.put(ProducerConfig.ACKS_CONFIG, "all");
        props.put(ProducerConfig.RETRIES_CONFIG, 3);
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        props.put(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, 120000);
        props.put(ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION, 5);
        props.put(JsonSerializer.ADD_TYPE_INFO_HEADERS, false);
        return new DefaultKafkaProducerFactory<>(props);
    }

    @Bean("kafkaTemplateChat")
    public KafkaTemplate<String, ChatEventDto> kafkaTemplateChat() {
        return new KafkaTemplate<>(producerFactoryChat());
    }

    @Bean("producerFactoryEncryptKey")
    public ProducerFactory<String, EncryptKeyEventDto> producerFactoryEncrypt() {
        Map<String, Object> props = new HashMap<>();

        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        props.put(ProducerConfig.ACKS_CONFIG, "all");
        props.put(ProducerConfig.RETRIES_CONFIG, 3);
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        props.put(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, 120000);
        props.put(ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION, 5);
        props.put(JsonSerializer.ADD_TYPE_INFO_HEADERS, false);
        return new DefaultKafkaProducerFactory<>(props);
    }

    @Bean("kafkaTemplateEncryptKey")
    public KafkaTemplate<String, EncryptKeyEventDto> kafkaTemplateEncrypt() {
        return new KafkaTemplate<>(producerFactoryEncrypt());
    }

    @Bean("consumerFactoryUserOnline")
    public ConsumerFactory<String, UserOnlineEvent> consumerFactoryUserOnline() {
        Map<String, Object> props = new HashMap<>();

        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, userOnlineGroup);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(JsonDeserializer.TRUSTED_PACKAGES, "ru.mescat");
        props.put(JsonDeserializer.USE_TYPE_INFO_HEADERS, false);
        props.put(JsonDeserializer.VALUE_DEFAULT_TYPE, "ru.mescat.message.dto.kafka.UserOnlineEvent");
        return new DefaultKafkaConsumerFactory<>(props);
    }

    @Bean("kafkaListenerUserOnline")
    public ConcurrentKafkaListenerContainerFactory<String, UserOnlineEvent> kafkaListenerUserOnline() {
        ConcurrentKafkaListenerContainerFactory<String, UserOnlineEvent> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactoryUserOnline());
        return factory;
    }

    @Bean
    public KafkaAdmin.NewTopics mescatTopics() {
        NewTopic deleteEncryptKeys = TopicBuilder.name(deleteEncryptKeysTopic)
                .partitions(3)
                .replicas(1)
                .build();
        NewTopic message = TopicBuilder.name(messageTopic)
                .partitions(3)
                .replicas(1)
                .build();
        NewTopic chat = TopicBuilder.name(chatTopic)
                .partitions(3)
                .replicas(1)
                .build();
        NewTopic encryptKeys = TopicBuilder.name(encryptKeysTopic)
                .partitions(3)
                .replicas(1)
                .build();
        NewTopic userOnline = TopicBuilder.name(userOnlineTopic)
                .partitions(3)
                .replicas(1)
                .build();

        return new KafkaAdmin.NewTopics(deleteEncryptKeys, message, chat, encryptKeys, userOnline);
    }
}
