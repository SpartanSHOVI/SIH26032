package com.annsetu.controller;

import com.annsetu.entity.Notification;
import com.annsetu.service.NotificationService;
import com.annsetu.service.QueueService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping
@Tag(name = "Queue", description = "Live queue tracking and dynamic wait time endpoints")
public class QueueController {

    private final QueueService queueService;
    private final NotificationService notificationService;

    public QueueController(QueueService queueService, NotificationService notificationService) {
        this.queueService = queueService;
        this.notificationService = notificationService;
    }

    @GetMapping({"/tokens/{tokenId}", "/queue/{tokenId}"})
    @Operation(summary = "Get token queue status and dynamic wait time")
    public ResponseEntity<?> getTokenDetails(@PathVariable String tokenId) {
        try {
            Long id = Long.valueOf(tokenId);
            Map<String, Object> details = queueService.getTokenDetails(id);
            return ResponseEntity.ok(details);
        } catch (NumberFormatException e) {
            // Could be a token number or UUID
            Optional<Map<String, Object>> opt = queueService.lookupToken(tokenId);
            return opt.<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Token not found")));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/tokens/lookup")
    @Operation(summary = "Look up active token by token number or mobile number")
    public ResponseEntity<?> lookupToken(@RequestParam String value) {
        Optional<Map<String, Object>> opt = queueService.lookupToken(value);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "No booking found for that mobile number or token."));
        }
        return ResponseEntity.ok(opt.get());
    }

    @GetMapping({"/farmers/{farmerId}/notifications", "/notifications"})
    @Operation(summary = "Get farmer notifications")
    public ResponseEntity<List<Notification>> getNotifications(@PathVariable(required = false) String farmerId) {
        if (farmerId != null) {
            try {
                return ResponseEntity.ok(notificationService.getFarmerNotifications(UUID.fromString(farmerId)));
            } catch (Exception ignored) {}
        }
        return ResponseEntity.ok(List.of());
    }
}