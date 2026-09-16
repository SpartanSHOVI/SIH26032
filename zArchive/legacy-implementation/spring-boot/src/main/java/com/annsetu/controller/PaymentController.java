package com.annsetu.controller;

import com.annsetu.dto.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/payments")
@Tag(name = "Payments", description = "Payment status and PFMS/DBT integration")
public class PaymentController {

    @GetMapping("/{procurementLotId}")
    @Operation(summary = "Get payment status for procurement lot", description = "Returns payment status from PFMS/DBT")
    public ResponseEntity<ApiResponse<PaymentResponse>> getPaymentStatus(@PathVariable String procurementLotId) {
        return ResponseEntity.ok(ApiResponse.success(new PaymentResponse(
            "payment-uuid", procurementLotId, "farmer-uuid",
            java.math.BigDecimal.valueOf(45200.00), "CREDITED",
            "PFMS20260120XYZ", "2026-01-20T14:30:00Z",
            java.util.Map.of("status", "SUCCESS", "schemeCode", "MSP-WHEAT"),
            "2026-01-20T11:00:00Z"
        ), "Payment status retrieved"));
    }

    @GetMapping("/my")
    @Operation(summary = "Get my payments", description = "Returns all payments for the authenticated farmer")
    public ResponseEntity<ApiResponse<List<PaymentResponse>>> getMyPayments() {
        return ResponseEntity.ok(ApiResponse.success(List.of(
            new PaymentResponse("payment-uuid", "lot-uuid", "farmer-uuid",
                java.math.BigDecimal.valueOf(45200.00), "CREDITED",
                "PFMS20260120XYZ", "2026-01-20T14:30:00Z",
                java.util.Map.of("status", "SUCCESS"), "2026-01-20T11:00:00Z")
        ), "Payments retrieved"));
    }
}