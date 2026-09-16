package com.annsetu.controller;

import com.annsetu.service.AdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/admin")
@Tag(name = "Admin", description = "Nodal officer command center, congestion monitoring, demand prediction, and smart slot allocation")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/overview")
    @Operation(summary = "Get daily KPI overview metrics")
    public ResponseEntity<Map<String, Object>> getOverview(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(adminService.getOverview(date));
    }

    @GetMapping("/centers")
    @Operation(summary = "Get center congestion and capacity monitoring table with optional filters")
    public ResponseEntity<List<Map<String, Object>>> getCenters(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String classification,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Integer limit) {
        return ResponseEntity.ok(adminService.getCentersOverview(date, state, district, classification, search, limit));
    }

    @GetMapping("/farmers")
    @Operation(summary = "Get master farmer bookings registry")
    public ResponseEntity<List<Map<String, Object>>> getFarmers() {
        return ResponseEntity.ok(adminService.getAllFarmersAndTokens());
    }

    @GetMapping("/centers/{centerId}/predict-demand")
    @Operation(summary = "Predict tomorrow's demand based on 14-day historical weekday patterns")
    public ResponseEntity<?> predictDemand(@PathVariable String centerId) {
        try {
            UUID cid = UUID.fromString(centerId);
            return ResponseEntity.ok(adminService.predictDemand(cid));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/centers/{centerId}/generate-slots")
    @Operation(summary = "Generate/balance slots based on expected demand and center throughput")
    public ResponseEntity<?> generateSlots(@PathVariable String centerId, @RequestBody Map<String, Object> body) {
        try {
            UUID cid = UUID.fromString(centerId);
            return ResponseEntity.ok(adminService.generateSlots(cid, body));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/analytics")
    @Operation(summary = "Get multi-state macro data engineering and feature engineering analytics")
    public ResponseEntity<Map<String, Object>> getAnalytics(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String state) {
        return ResponseEntity.ok(adminService.getMacroAnalytics(date, state));
    }

    @PostMapping("/rebalance-mandi")
    @Operation(summary = "Execute intelligent inter-mandi load rebalancing")
    public ResponseEntity<?> rebalanceMandi(@RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(adminService.rebalanceMandi(body));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
