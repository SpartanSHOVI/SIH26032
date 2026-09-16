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
@Schema(description = "Request to update farmer profile")
public class UpdateProfileRequest {

    @NotBlank(message = "Name is required")
    @Size(min = 2, max = 255, message = "Name must be between 2 and 255 characters")
    @Schema(description = "Full name", example = "John Doe")
    private String name;

    @NotBlank(message = "Phone number is required")
    @Pattern(regexp = "\\d{10}", message = "Phone must be 10 digits")
    @Schema(description = "10-digit mobile number", example = "9876543210")
    private String phone;

    @NotBlank(message = "Preferred language is required")
    @Schema(description = "Preferred language code", example = "hi")
    private String preferredLanguage;

    @Schema(description = "Preferred center ID")
    private String centerPreferenceId;
}