package com.annsetu.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Request to register a new farmer")
public class RegisterRequest {

    @NotBlank(message = "Aadhaar number is required")
    @Pattern(regexp = "\\d{12}", message = "Aadhaar must be 12 digits")
    @Schema(description = "12-digit Aadhaar number", example = "123456789012")
    private String aadhaar;

    @NotBlank(message = "OTP is required")
    @Pattern(regexp = "\\d{6}", message = "OTP must be 6 digits")
    @Schema(description = "6-digit OTP received via SMS", example = "123456")
    private String otp;

    @NotBlank(message = "Name is required")
    @Size(min = 2, max = 255, message = "Name must be between 2 and 255 characters")
    @Schema(description = "Full name as per Aadhaar", example = "John Doe")
    private String name;

    @NotBlank(message = "Phone number is required")
    @Pattern(regexp = "\\d{10}", message = "Phone must be 10 digits")
    @Schema(description = "10-digit mobile number", example = "9876543210")
    private String phone;

    @NotBlank(message = "State code is required")
    @Size(min = 2, max = 10, message = "State code must be 2-10 characters")
    @Schema(description = "State code (e.g., PB, HR, UP)", example = "PB")
    private String stateCode;

    @NotBlank(message = "Preferred language is required")
    @Schema(description = "Preferred language code (hi, en, pa)", example = "hi")
    private String preferredLanguage;

    @Schema(description = "Preferred procurement center ID (optional)")
    private String centerPreferenceId;
}