package com.annsetu.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Slot availability response")
public class SlotAvailabilityResponse {

    @Schema(description = "Time window start", example = "08:00")
    private LocalTime timeWindowStart;

    @Schema(description = "Time window end", example = "10:00")
    private LocalTime timeWindowEnd;

    @Schema(description = "Whether slots are available", example = "true")
    private Boolean available;

    @Schema(description = "Remaining capacity", example = "15")
    private Integer remainingCapacity;

    @Schema(description = "Daily capacity", example = "200")
    private Integer dailyCapacity;

    @Schema(description = "Booked count", example = "185")
    private Integer bookedCount;
}