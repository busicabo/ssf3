package ru.mescat.message.exception;

public class MaxActiveKeysLimitExceededException extends RuntimeException {
    public MaxActiveKeysLimitExceededException(String message) {
        super(message);
    }
}
