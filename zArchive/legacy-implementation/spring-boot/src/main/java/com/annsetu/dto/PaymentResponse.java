package com.annsetu.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Payment response")
public class PaymentResponse {

    @Schema(description = "Payment UUID", example = "550e8400-e29b-41d4-a716-446655440000")
    private String id;

    @Schema(description = "Procurement lot UUID", example = "550e8400-e29b-41d4-a716-446655440000")
    private String procurementLotId;

    @Schema(description = "Farmer UUID", example = "550e8400-e29b-41d4-a716-446655440000")
    private String farmerId;

    @Schema(description = "Payment amount", example = "45200.00")
    private BigDecimal amount;

    @Schema(description = "Payment status", example = "CREDITED")
    private String status;

    @Schema(description = "UTR reference from PFMS", example = "PFMS20260120XYZ")
    private String utrReference;

    @Schema(description = "Credited at timestamp", example = "2026-01-20T14:30:00Z")
    private String creditedAt;

    @Schema(description = "PFMS response details")
    private Object pfmsResponse;

    @Schema(description = "Created at timestamp", example = "2026-01-20T11:00:00Z")
    private String createdAt;
}