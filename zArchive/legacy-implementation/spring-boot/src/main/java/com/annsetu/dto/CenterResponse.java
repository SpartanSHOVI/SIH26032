package com.annsetu.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Procurement center response")
public class CenterResponse {

    @Schema(description = "Center UUID", example = "550e8400-e29b-41d4-a716-446655440001")
    private String id;

    @Schema(description = "Center code", example = "PUN001")
    private String code;

    @Schema(description = "Center name", example = "Khanna Grain Market")
    private String name;

    @Schema(description = "State code", example = "PB")
    private String stateCode;

    @Schema(description = "Daily capacity", example = "200")
    private Integer dailyCapacity;

    @Schema(description = "Center address")
    private AddressResponse address;

    @Schema(description = "Whether center is active", example = "true")
    private Boolean active;
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Address response")
    public static class AddressResponse {

    @Schema(description = "District", example = "Ludhiana")
    private String district;

    @Schema(description = "Address line", example = "GT Road, Khanna")
    private String address;

    @Schema(description = "Pincode", example = "141401")
        private String pincode;
    }
}