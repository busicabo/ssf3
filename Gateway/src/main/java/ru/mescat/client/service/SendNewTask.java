package ru.mescat.client.service;

import org.springframework.kafka.KafkaException;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import ru.mescat.client.dto.NewTask;

@Service
public class SendNewTask {

    private KafkaTemplate<String, NewTask> kafkaTemplate;
    private String topic;

    public SendNewTask(KafkaTemplate<String,NewTask> kafkaTemplate){
        this.kafkaTemplate=kafkaTemplate;
    }

    public void sendNewTask(NewTask newTask){
        try{
            var result = kafkaTemplate.send(topic,newTask).get();
        } catch (Exception e){
            throw new KafkaException("Не удалось отправить задачу.");
        }
    }
}
