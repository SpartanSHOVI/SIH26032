package com.annsetu.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.FutureOrPresent;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Request to create a booking")
public class CreateBookingRequest {

    @NotBlank(message = "Center ID is required")
    @Schema(description = "Procurement center UUID", example = "550e8400-e29b-41d4-a716-446655440001")
    private String centerId;

    @NotNull(message = "Booking date is required")
    @FutureOrPresent(message = "Booking date must be today or future")
    @Schema(description = "Booking date (YYYY-MM-DD)", example = "2026-01-20")
    private LocalDate bookingDate;

    @NotBlank(message = "Time window start is required")
    @Schema(description = "Time window start (HH:mm)", example = "08:00")
    private String timeWindowStart;

    @NotBlank(message = "Idempotency key is required")
    @Schema(description = "Unique key to prevent duplicate bookings", example = "booking-550e8400-e29b-41d4-a716-446655440000")
    private String idempotencyKey;
}