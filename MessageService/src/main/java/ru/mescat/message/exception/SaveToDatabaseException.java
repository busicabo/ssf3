package ru.mescat.message.exception;

public class SaveToDatabaseException extends RuntimeException {
    public SaveToDatabaseException(String message) {
        super(message);
    }
}
