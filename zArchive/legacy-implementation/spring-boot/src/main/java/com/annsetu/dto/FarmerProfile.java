package com.annsetu.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Farmer profile information")
public class FarmerProfile {

    @Schema(description = "Farmer UUID", example = "550e8400-e29b-41d4-a716-446655440000")
    private String id;

    @Schema(description = "AgriStack Farmer ID", example = "FARMER123456")
    private String farmerId;

    @Schema(description = "Full name", example = "John Doe")
    private String name;

    @Schema(description = "Masked Aadhaar (XXXX-XXXX-1234)", example = "XXXX-XXXX-1234")
    private String aadhaarMasked;

    @Schema(description = "Masked phone (XXXXXXXX12)", example = "XXXXXXXX12")
    private String phoneMasked;

    @Schema(description = "State code", example = "PB")
    private String stateCode;

    @Schema(description = "Preferred language code", example = "hi")
    private String preferredLanguage;

    @Schema(description = "Preferred center ID", example = "550e8400-e29b-41d4-a716-446655440001")
    private String centerPreferenceId;

    @Schema(description = "Whether consent is given", example = "true")
    private Boolean consentGiven;

    @Schema(description = "Consent timestamp", example = "2026-01-15T10:30:00Z")
    private String consentTimestamp;
}