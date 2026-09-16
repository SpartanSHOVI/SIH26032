package com.annsetu.controller;

import com.annsetu.entity.CenterAnnouncement;
import com.annsetu.entity.MessageLog;
import com.annsetu.service.CenterOperatorService;
import com.annsetu.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping
@Tag(name = "Center Operations", description = "Procurement center operator queue management and stage advancement endpoints")
public class CenterController {

    private final CenterOperatorService centerOperatorService;
    private final NotificationService notificationService;

    public CenterController(CenterOperatorService centerOperatorService, NotificationService notificationService) {
        this.centerOperatorService = centerOperatorService;
        this.notificationService = notificationService;
    }

    @GetMapping("/centers/{centerId}/queue")
    @Operation(summary = "Get today's queue for procurement center")
    public ResponseEntity<?> getCenterQueue(
            @PathVariable String centerId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        try {
            UUID cid = UUID.fromString(centerId);
            return ResponseEntity.ok(centerOperatorService.getCenterQueue(cid, date));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/centers/{centerId}/analytics")
    @Operation(summary = "Get real-time mandi data engineering and feature engineering analytics")
    public ResponseEntity<?> getCenterAnalytics(
            @PathVariable String centerId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        try {
            UUID cid = UUID.fromString(centerId);
            return ResponseEntity.ok(centerOperatorService.getCenterAnalytics(cid, date));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/centers/{centerId}/call-next")
    @Operation(summary = "Call the next farmer waiting in queue")
    public ResponseEntity<?> callNextFarmer(
            @PathVariable String centerId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        try {
            UUID cid = UUID.fromString(centerId);
            Map<String, Object> result = centerOperatorService.callNextFarmer(cid, date);
            return ResponseEntity.ok(result);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/tokens/{tokenId}/status")
    @Operation(summary = "Update token procurement status")
    public ResponseEntity<?> updateStatus(@PathVariable Long tokenId, @RequestBody Map<String, Object> body) {
        try {
            Map<String, Object> result = centerOperatorService.updateTokenStatus(tokenId, body);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/tokens/{tokenId}/payment")
    @Operation(summary = "Update token payment details")
    public ResponseEntity<?> updatePayment(@PathVariable Long tokenId, @RequestBody Map<String, Object> body) {
        try {
            Map<String, Object> result = centerOperatorService.updatePayment(tokenId, body);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping({"/centers/{centerId}/announcements", "/centers/{centerId}/announcement"})
    @Operation(summary = "Create emergency announcement and broadcast to waiting farmers")
    public ResponseEntity<?> createAnnouncement(@PathVariable String centerId, @RequestBody Map<String, Object> body) {
        try {
            UUID cid = UUID.fromString(centerId);
            Map<String, Object> result = centerOperatorService.createAnnouncement(cid, body);
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/centers/{centerId}/announcements")
    @Operation(summary = "Get announcements for procurement center")
    public ResponseEntity<List<CenterAnnouncement>> getAnnouncements(@PathVariable String centerId) {
        try {
            UUID cid = UUID.fromString(centerId);
            return ResponseEntity.ok(centerOperatorService.getAnnouncements(cid));
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/messages")
    @Operation(summary = "Get simulated SMS and WhatsApp message logs")
    public ResponseEntity<List<MessageLog>> getMessageLogs(
            @RequestParam(required = false) String farmer_id,
            @RequestParam(required = false) String center_id) {
        UUID fid = farmer_id != null ? UUID.fromString(farmer_id) : null;
        UUID cid = center_id != null ? UUID.fromString(center_id) : null;
        return ResponseEntity.ok(notificationService.getMessageLogs(fid, cid));
    }

    @PostMapping("/centers/operator/login")
    @Operation(summary = "Login as procurement center operator for unique mandi session")
    public ResponseEntity<?> operatorLogin(@RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(centerOperatorService.operatorLogin(body));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
