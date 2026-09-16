package com.annsetu.controller;

import com.annsetu.service.UssdService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping
@Tag(name = "USSD & Feature Phone Channel", description = "Low-connectivity 2G/3G USSD gateway endpoint (*555#) for illiterate and non-smartphone farmers")
public class UssdController {

    private final UssdService ussdService;

    public UssdController(UssdService ussdService) {
        this.ussdService = ussdService;
    }

    @PostMapping(value = "/ussd", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.TEXT_PLAIN_VALUE)
    @Operation(summary = "Process USSD telecom gateway webhook via JSON")
    public ResponseEntity<String> handleUssdJson(@RequestBody Map<String, Object> body) {
        String sid = body.getOrDefault("sessionId", "session-" + System.currentTimeMillis()).toString();
        String sc = body.getOrDefault("serviceCode", "*555#").toString();
        String phone = body.containsKey("phoneNumber") ? body.get("phoneNumber").toString()
                : (body.containsKey("mobile") ? body.get("mobile").toString() : "9876543210");
        String txt = body.getOrDefault("text", "").toString();

        String response = ussdService.processUssd(sid, sc, phone, txt);
        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/ussd", consumes = {MediaType.APPLICATION_FORM_URLENCODED_VALUE, MediaType.ALL_VALUE}, produces = MediaType.TEXT_PLAIN_VALUE)
    @Operation(summary = "Process USSD telecom gateway webhook via Form-urlencoded or URL query")
    public ResponseEntity<String> handleUssdForm(
            @RequestParam(required = false, defaultValue = "sim-session") String sessionId,
            @RequestParam(required = false, defaultValue = "*555#") String serviceCode,
            @RequestParam(required = false, defaultValue = "9876543210") String phoneNumber,
            @RequestParam(required = false, defaultValue = "") String text) {

        String response = ussdService.processUssd(sessionId, serviceCode, phoneNumber, text);
        return ResponseEntity.ok(response);
    }

    @GetMapping(value = "/ussd", produces = MediaType.TEXT_PLAIN_VALUE)
    @Operation(summary = "Simulate USSD dial query via GET request")
    public ResponseEntity<String> handleUssdGet(
            @RequestParam(defaultValue = "sim-session") String sessionId,
            @RequestParam(defaultValue = "*555#") String serviceCode,
            @RequestParam(defaultValue = "9876543210") String phoneNumber,
            @RequestParam(defaultValue = "") String text) {

        String response = ussdService.processUssd(sessionId, serviceCode, phoneNumber, text);
        return ResponseEntity.ok(response);
    }
}
