package com.annsetu.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Procurement lot response")
public class ProcurementResponse {

    @Schema(description = "Procurement lot UUID", example = "550e8400-e29b-41d4-a716-446655440000")
    private String id;

    @Schema(description = "Farmer UUID", example = "550e8400-e29b-41d4-a716-446655440000")
    private String farmerId;

    @Schema(description = "Center UUID", example = "550e8400-e29b-41d4-a716-446655440001")
    private String centerId;

    @Schema(description = "Center name", example = "Khanna Grain Market")
    private String centerName;

    @Schema(description = "Lot status", example = "WEIGHING")
    private String lotStatus;

    @Schema(description = "Gross weight in quintals", example = "50.5")
    private BigDecimal grossWeight;

    @Schema(description = "Tare weight in quintals", example = "5.3")
    private BigDecimal tareWeight;

    @Schema(description = "Net weight in quintals", example = "45.2")
    private BigDecimal netWeight;

    @Schema(description = "Moisture percentage", example = "12.5")
    private BigDecimal moisturePercent;

    @Schema(description = "Quality check passed", example = "true")
    private Boolean qualityPass;

    @Schema(description = "Staff ID who processed", example = "STAFF001")
    private String staffId;

    @Schema(description = "Started at timestamp", example = "2026-01-20T10:00:00Z")
    private String startedAt;

    @Schema(description = "Completed at timestamp", example = "2026-01-20T10:45:00Z")
    private String completedAt;

    @Schema(description = "Booking UUID", example = "550e8400-e29b-41d4-a716-446655440000")
    private String bookingId;

    @Schema(description = "Token number", example = "42")
    private Integer tokenNumber;

    @Schema(description = "Booking date", example = "2026-01-20")
    private String bookingDate;
}