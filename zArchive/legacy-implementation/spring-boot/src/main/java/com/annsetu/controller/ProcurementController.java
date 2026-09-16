package com.annsetu.controller;

import com.annsetu.dto.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/procurement")
@Tag(name = "Procurement", description = "Procurement workflow and status endpoints")
public class ProcurementController {

    @GetMapping("/{bookingId}")
    @Operation(summary = "Get procurement status for booking", description = "Returns current procurement stage and details")
    public ResponseEntity<ApiResponse<ProcurementResponse>> getProcurementStatus(@PathVariable String bookingId) {
        return ResponseEntity.ok(ApiResponse.success(new ProcurementResponse(
            "lot-uuid", "farmer-uuid", "center-uuid", "Khanna Grain Market",
            "WEIGHING", java.math.BigDecimal.valueOf(50.5), java.math.BigDecimal.valueOf(5.3),
            java.math.BigDecimal.valueOf(45.2), java.math.BigDecimal.valueOf(12.5), true,
            "STAFF001", "2026-01-20T10:00:00Z", null, bookingId, 42, "2026-01-20"
        ), "Procurement status retrieved"));
    }

    @GetMapping("/my")
    @Operation(summary = "Get my procurement history", description = "Returns all procurement records for the authenticated farmer")
    public ResponseEntity<ApiResponse<List<ProcurementResponse>>> getMyProcurement() {
        return ResponseEntity.ok(ApiResponse.success(List.of(
            new ProcurementResponse("lot-uuid", "farmer-uuid", "center-uuid", "Khanna Grain Market",
                "ACCEPTED", java.math.BigDecimal.valueOf(50.5), java.math.BigDecimal.valueOf(5.3),
                java.math.BigDecimal.valueOf(45.2), java.math.BigDecimal.valueOf(12.5), true,
                "STAFF001", "2026-01-20T10:00:00Z", "2026-01-20T10:45:00Z", "booking-uuid", 42, "2026-01-20")
        ), "Procurement history retrieved"));
    }
}