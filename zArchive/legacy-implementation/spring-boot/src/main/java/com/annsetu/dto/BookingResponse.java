package com.annsetu.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Booking response")
public class BookingResponse {

    @Schema(description = "Booking UUID", example = "550e8400-e29b-41d4-a716-446655440000")
    private String id;

    @Schema(description = "Farmer UUID", example = "550e8400-e29b-41d4-a716-446655440000")
    private String farmerId;

    @Schema(description = "Center UUID", example = "550e8400-e29b-41d4-a716-446655440001")
    private String centerId;

    @Schema(description = "Center name", example = "Khanna Grain Market")
    private String centerName;

    @Schema(description = "Booking date", example = "2026-01-20")
    private LocalDate bookingDate;

    @Schema(description = "Time window start", example = "08:00")
    private LocalTime timeWindowStart;

    @Schema(description = "Time window end", example = "10:00")
    private LocalTime timeWindowEnd;

    @Schema(description = "Token number", example = "42")
    private Integer tokenNumber;

    @Schema(description = "Booking status", example = "CONFIRMED")
    private String status;

    @Schema(description = "Creation timestamp", example = "2026-01-15T10:30:00Z")
    private String createdAt;
}