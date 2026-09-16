package com.annsetu.controller;

import com.annsetu.service.CenterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/locations")
@Tag(name = "Locations", description = "Hierarchical location discovery endpoints")
public class LocationController {

    private final CenterService centerService;

    public LocationController(CenterService centerService) {
        this.centerService = centerService;
    }

    @GetMapping("/states")
    @Operation(summary = "Get distinct states")
    public ResponseEntity<List<String>> getStates() {
        return ResponseEntity.ok(centerService.getStates());
    }

    @GetMapping("/districts")
    @Operation(summary = "Get distinct districts for a state")
    public ResponseEntity<List<String>> getDistricts(@RequestParam String state) {
        return ResponseEntity.ok(centerService.getDistricts(state));
    }

    @GetMapping("/classifications")
    @Operation(summary = "Get distinct mandi classifications (APMC, Grain Market, Fruit & Vegetable, Sub Yard, etc.)")
    public ResponseEntity<List<String>> getClassifications() {
        return ResponseEntity.ok(centerService.getClassifications());
    }

    @GetMapping("/centers")
    @Operation(summary = "Get procurement centers for state and district with optional classification and search filter")
    public ResponseEntity<List<Map<String, Object>>> getCenters(
            @RequestParam String state,
            @RequestParam String district,
            @RequestParam(required = false) String classification,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(centerService.getCentersByLocation(state, district, classification, search));
    }
}
