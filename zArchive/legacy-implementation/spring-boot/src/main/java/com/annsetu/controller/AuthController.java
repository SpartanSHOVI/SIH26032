package com.annsetu.controller;

import com.annsetu.entity.Farmer;
import com.annsetu.service.AuthService;
import com.annsetu.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping
@Tag(name = "Authentication", description = "Farmer authentication, registration, and profile endpoints")
public class AuthController {

    private final AuthService authService;
    private final NotificationService notificationService;

    public AuthController(AuthService authService, NotificationService notificationService) {
        this.authService = authService;
        this.notificationService = notificationService;
    }

    @PostMapping("/auth/register")
    @Operation(summary = "Register new farmer")
    public ResponseEntity<?> register(@RequestBody Map<String, Object> req) {
        try {
            Farmer farmer = authService.registerFarmer(req);
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("farmer_id", farmer.getId().toString());
            res.put("id", farmer.getId().toString());
            res.put("name", farmer.getName());
            res.put("mobile", farmer.getMobile());
            res.put("token", "jwt-mock-token-" + farmer.getId());
            res.put("accessToken", "jwt-mock-token-" + farmer.getId());
            res.put("refreshToken", "refresh-mock-token-" + farmer.getId());
            res.put("farmer", farmer);
            res.put("message", "Registered successfully");
            return ResponseEntity.status(HttpStatus.CREATED).body(res);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/auth/login")
    @Operation(summary = "Farmer login via mobile, Aadhaar, or Farmer ID with password/OTP")
    public ResponseEntity<?> login(@RequestBody Map<String, Object> req) {
        String credential = req.get("mobile") != null ? req.get("mobile").toString().trim() :
                (req.get("phone") != null ? req.get("phone").toString().trim() :
                (req.get("aadhaar") != null ? req.get("aadhaar").toString().trim() :
                (req.get("credential") != null ? req.get("credential").toString().trim() : "")));
        String password = req.get("password") != null ? req.get("password").toString() :
                (req.get("otp") != null ? req.get("otp").toString() : "");

        Optional<Farmer> opt = authService.login(credential, password);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid credentials. Please enter a valid registered mobile number, Aadhaar, or demo OTP (123456)."));
        }

        Farmer f = opt.get();
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("farmer_id", f.getId().toString());
        res.put("id", f.getId().toString());
        res.put("name", f.getName());
        res.put("mobile", f.getMobile());
        res.put("crop", f.getCrop());
        res.put("quantity", f.getQuantity());
        res.put("state", f.getState());
        res.put("district", f.getDistrict());
        res.put("address", f.getAddress());
        res.put("preferred_center_id", f.getPreferredCenterId());
        res.put("bank_account", f.getBankAccount());
        res.put("ifsc", f.getIfsc());
        res.put("language", f.getLanguage());
        res.put("token", "jwt-mock-token-" + f.getId());
        res.put("accessToken", "jwt-mock-token-" + f.getId());
        res.put("refreshToken", "refresh-mock-token-" + f.getId());
        res.put("farmer", f);
        return ResponseEntity.ok(res);
    }

    @PostMapping({"/auth/request-otp", "/auth/send-otp"})
    @Operation(summary = "Request demo OTP for mobile or Aadhaar")
    public ResponseEntity<?> requestOtp(@RequestBody Map<String, Object> req) {
        String mobile = req.get("mobile") != null ? req.get("mobile").toString().trim() : "";
        String aadhaar = req.get("aadhaar") != null ? req.get("aadhaar").toString().trim() : "";
        String target = !mobile.isBlank() ? mobile : aadhaar;

        String demoOtp = "123456";
        Optional<Farmer> opt = authService.login(target, demoOtp);
        opt.ifPresent(farmer -> notificationService.logMessage(
                farmer.getId(), null, "SMS", farmer.getMobile(), "Your AnnSetu demo verification OTP is 123456."
        ));

        return ResponseEntity.ok(Map.of(
                "message", "Demo OTP sent by SMS and WhatsApp.",
                "demo_otp", demoOtp,
                "target", target
        ));
    }

    @PostMapping("/auth/verify-otp")
    @Operation(summary = "Verify demo OTP")
    public ResponseEntity<?> verifyOtp(@RequestBody Map<String, Object> req) {
        String otp = req.get("otp") != null ? req.get("otp").toString().trim() : "";
        String target = req.get("mobile") != null ? req.get("mobile").toString().trim() :
                (req.get("aadhaar") != null ? req.get("aadhaar").toString().trim() : "");

        if (!"123456".equals(otp)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid OTP. Demo OTP is 123456."));
        }

        Farmer farmer = authService.login(target, "123456").orElse(null);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("accessToken", "jwt-mock-token-" + (farmer != null ? farmer.getId() : "demo"));
        res.put("refreshToken", "refresh-mock-token-" + (farmer != null ? farmer.getId() : "demo"));
        res.put("message", "OTP verified successfully");
        if (farmer != null) {
            res.put("farmer", farmer);
            res.put("farmer_id", farmer.getId().toString());
            res.put("id", farmer.getId().toString());
            res.put("name", farmer.getName());
            res.put("mobile", farmer.getMobile());
        }
        return ResponseEntity.ok(res);
    }

    @GetMapping({"/auth/profile", "/farmers/{id}"})
    @Operation(summary = "Get farmer profile")
    public ResponseEntity<?> getProfile(@PathVariable(required = false) String id) {
        if (id == null) {
            return ResponseEntity.ok(Map.of("message", "Profile placeholder"));
        }
        try {
            UUID uuid = UUID.fromString(id);
            return authService.getById(uuid)
                    .<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Farmer not found")));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid farmer UUID"));
        }
    }

    @PatchMapping({"/auth/profile", "/farmers/{id}"})
    @Operation(summary = "Update farmer profile")
    public ResponseEntity<?> updateProfile(@PathVariable(required = false) String id, @RequestBody Map<String, Object> data) {
        if (id == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Farmer ID required"));
        }
        try {
            UUID uuid = UUID.fromString(id);
            Farmer updated = authService.updateProfile(uuid, data);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/farmers/lookup")
    @Operation(summary = "Look up farmer by mobile number")
    public ResponseEntity<?> lookupFarmer(@RequestParam String mobile) {
        Optional<Farmer> opt = authService.lookupByMobile(mobile);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Farmer not found"));
        }
        return ResponseEntity.ok(opt.get());
    }
}