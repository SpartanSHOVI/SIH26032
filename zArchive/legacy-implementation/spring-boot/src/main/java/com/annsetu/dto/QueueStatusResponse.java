package com.annsetu.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Queue status response")
public class QueueStatusResponse {

    @Schema(description = "Booking UUID", example = "550e8400-e29b-41d4-a716-446655440000")
    private String bookingId;

    @Schema(description = "Farmer UUID", example = "550e8400-e29b-41d4-a716-446655440000")
    private String farmerId;

    @Schema(description = "Center UUID", example = "550e8400-e29b-41d4-a716-446655440001")
    private String centerId;

    @Schema(description = "Center name", example = "Khanna Grain Market")
    private String centerName;

    @Schema(description = "Current queue position", example = "5")
    private Integer queuePosition;

    @Schema(description = "Queue status", example = "WAITING")
    private String status;

    @Schema(description = "Estimated wait time in minutes", example = "18")
    private Integer estimatedWaitMinutes;

    @Schema(description = "Last updated timestamp", example = "2026-01-20T10:30:00Z")
    private String lastUpdated;

    @Schema(description = "Booking date", example = "2026-01-20")
    private String bookingDate;

    @Schema(description = "Time window start", example = "08:00")
    private LocalTime timeWindowStart;

    @Schema(description = "Time window end", example = "10:00")
    private LocalTime timeWindowEnd;

    @Schema(description = "Token number", example = "42")
    private Integer tokenNumber;
}