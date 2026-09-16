package com.annsetu.controller;

import com.annsetu.service.IvrService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping
@Tag(name = "IVR Voice Helpline & Outbound Dialing", description = "Toll-free voice helpline (1800-180-SETU) and automated voice broadcast updates for low-literacy farmers")
public class IvrController {

    private final IvrService ivrService;

    public IvrController(IvrService ivrService) {
        this.ivrService = ivrService;
    }

    @PostMapping("/ivr/call")
    @Operation(summary = "Process IVR call step and DTMF key presses (Toll-Free 1800-180-SETU)")
    public ResponseEntity<Map<String, Object>> handleIvrCall(@RequestBody(required = false) Map<String, Object> body) {
        String callerPhone = body != null && body.get("caller_phone") != null ? body.get("caller_phone").toString() : "9876543210";
        String digits = body != null && body.get("digits") != null ? body.get("digits").toString() : "";
        String lang = body != null && body.get("language") != null ? body.get("language").toString() : "hi";

        Map<String, Object> result = ivrService.handleIncomingCall(callerPhone, digits, lang);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/ivr/alerts")
    @Operation(summary = "Get recorded voice alerts / broadcasts for farmer")
    public ResponseEntity<List<Map<String, Object>>> getVoiceAlerts(
            @RequestParam(required = false) String farmer_id,
            @RequestParam(required = false) String mobile) {

        UUID fid = null;
        if (farmer_id != null && !farmer_id.isBlank()) {
            try {
                fid = UUID.fromString(farmer_id);
            } catch (Exception ignored) {}
        }

        List<Map<String, Object>> alerts = ivrService.getRecordedVoiceAlerts(fid, mobile);
        return ResponseEntity.ok(alerts);
    }
}
