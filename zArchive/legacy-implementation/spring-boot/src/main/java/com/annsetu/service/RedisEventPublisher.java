package com.annsetu.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Service
public class RedisEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(RedisEventPublisher.class);
    private static final String QUEUE_CHANNEL = "queue:updates";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Autowired
    public RedisEventPublisher(@Autowired(required = false) StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    public void publishQueueEvent(String type, String centerId, String farmerId, String tokenNumber,
                                  String status, Integer position, Integer waitMinutes) {
        if (redisTemplate == null) {
            log.debug("Redis template not configured, skipping event publish");
            return;
        }

        try {
            Map<String, Object> event = new HashMap<>();
            event.put("type", type);
            event.put("centerId", centerId);
            if (farmerId != null) event.put("farmerId", farmerId);
            if (tokenNumber != null) event.put("tokenNumber", tokenNumber);
            if (status != null) event.put("status", status);
            if (position != null) event.put("queuePosition", position);
            if (waitMinutes != null) event.put("estimatedWaitMinutes", waitMinutes);
            event.put("timestamp", Instant.now().toString());

            String message = objectMapper.writeValueAsString(event);
            redisTemplate.convertAndSend(QUEUE_CHANNEL, message);
            log.info("Published real-time event to {}: {}", QUEUE_CHANNEL, message);
        } catch (Exception e) {
            log.warn("Could not publish Redis event (non-critical): {}", e.getMessage());
        }
    }
}
