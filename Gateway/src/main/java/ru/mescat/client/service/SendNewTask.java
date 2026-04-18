package ru.mescat.client.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.KafkaException;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import ru.mescat.client.dto.NewTask;

@Service
public class SendNewTask {

    private final KafkaTemplate<String, NewTask> kafkaTemplate;

    @Value("${spring.kafka.message.topic:message-service}")
    private String topic;

    public SendNewTask(KafkaTemplate<String, NewTask> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void sendNewTask(NewTask newTask) {
        try {
            kafkaTemplate.send(topic, newTask).get();
        } catch (Exception e) {
            throw new KafkaException("Не удалось отправить задачу.");
        }
    }
}
