package com.annsetu.service;

import com.annsetu.entity.Farmer;
import com.annsetu.repository.FarmerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    private final FarmerRepository farmerRepository;
    private final NotificationService notificationService;

    public AuthService(FarmerRepository farmerRepository, NotificationService notificationService) {
        this.farmerRepository = farmerRepository;
        this.notificationService = notificationService;
    }

    public static String hashPassword(String password) {
        if (password == null) return null;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedhash = digest.digest(password.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : encodedhash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    @Transactional
    public Farmer registerFarmer(Map<String, Object> req) {
        String name = req.get("name") != null ? req.get("name").toString().trim() : null;

        // Support both "mobile" and "phone"
        String rawMobile = req.get("mobile") != null ? req.get("mobile").toString() :
                (req.get("phone") != null ? req.get("phone").toString() : null);
        String mobile = rawMobile != null ? rawMobile.replaceAll("[^0-9]", "") : null;

        String password = req.get("password") != null && !req.get("password").toString().isBlank() ?
                req.get("password").toString() : "123456";

        String state = req.get("state") != null ? req.get("state").toString().trim() :
                (req.get("stateCode") != null ? req.get("stateCode").toString().trim() : null);
        String district = req.get("district") != null ? req.get("district").toString().trim() : null;
        String address = req.get("address") != null ? req.get("address").toString().trim() :
                (district != null && state != null ? district + ", " + state : "India");
        String crop = req.get("crop") != null ? req.get("crop").toString().trim() : "Wheat";
        Double quantity = req.get("quantity") != null ? Double.valueOf(req.get("quantity").toString()) : 30.0;

        String bankAccount = req.get("bank_account") != null ? req.get("bank_account").toString().trim() :
                (req.get("bankAccount") != null ? req.get("bankAccount").toString().trim() : null);
        String ifsc = req.get("ifsc") != null ? req.get("ifsc").toString().trim().toUpperCase() : null;

        String language = req.get("language") != null ? req.get("language").toString() :
                (req.get("preferredLanguage") != null ? req.get("preferredLanguage").toString() : "English");

        String rawAadhaar = req.get("aadhaar") != null ? req.get("aadhaar").toString().replaceAll("[^0-9]", "") : null;

        UUID centerId = null;
        Object rawCenterId = req.get("preferred_center_id") != null ? req.get("preferred_center_id") : req.get("centerPreferenceId");
        if (rawCenterId != null && !rawCenterId.toString().isBlank()) {
            try {
                centerId = UUID.fromString(rawCenterId.toString());
            } catch (Exception ignored) {}
        }

        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Farmer full name is required");
        }
        if (mobile == null || mobile.length() != 10) {
            throw new IllegalArgumentException("A valid 10-digit mobile number is required");
        }

        if (farmerRepository.existsByMobile(mobile)) {
            throw new IllegalStateException("A farmer account already exists for this mobile number (" + mobile + "). Please log in.");
        }

        Farmer farmer = new Farmer();
        farmer.setName(name);
        farmer.setMobile(mobile);
        farmer.setFarmerId("FARMER-" + mobile);
        farmer.setPasswordHash(hashPassword(password));
        farmer.setAddress(address);
        farmer.setState(state);
        farmer.setDistrict(district);
        farmer.setCrop(crop);
        farmer.setQuantity(quantity);
        farmer.setBankAccount(bankAccount);
        farmer.setIfsc(ifsc);
        farmer.setPreferredCenterId(centerId);
        farmer.setLanguage(language);
        farmer.setPreferredLanguage(language.length() <= 10 ? language : "en");
        farmer.setConsentGiven(true);

        if (rawAadhaar != null && rawAadhaar.length() == 12) {
            farmer.setAadhaarHash(hashPassword(rawAadhaar));
            farmer.setAadhaarMasked("XXXX-XXXX-" + rawAadhaar.substring(8));
        } else {
            farmer.setAadhaarMasked("XXXX-XXXX-" + (mobile.length() >= 4 ? mobile.substring(6) : "1234"));
        }

        farmer.setPhoneMasked("XXXXXX" + (mobile.length() >= 4 ? mobile.substring(6) : "1234"));
        farmer.setStateCode(state != null && state.length() >= 2 ? state.substring(0, 2).toUpperCase() : "IN");

        Farmer saved = farmerRepository.save(farmer);

        notificationService.pushNotification(saved.getId(), "Welcome " + name + "! Your AnnSetu farmer account has been created.");
        notificationService.logMessage(saved.getId(), centerId, "SMS", mobile, "Welcome " + name + " to AnnSetu Kisan Platform! Registered for " + crop + " procurement.");
        notificationService.logMessage(saved.getId(), centerId, "WhatsApp", mobile, "🌾 Welcome " + name + " to AnnSetu Kisan Platform! Account ID: " + saved.getFarmerId());

        return saved;
    }

    public Optional<Farmer> login(String credential, String password) {
        if (credential == null || credential.isBlank()) return Optional.empty();
        String cred = credential.trim();
        String cleaned = cred.replaceAll("[^0-9]", "");

        Optional<Farmer> opt = Optional.empty();

        // 1. Try lookup by 10-digit mobile number
        if (cleaned.length() == 10) {
            opt = farmerRepository.findByMobile(cleaned);
        }

        // 2. Try lookup by 12-digit Aadhaar hash
        if (opt.isEmpty() && cleaned.length() == 12) {
            opt = farmerRepository.findByAadhaarHash(hashPassword(cleaned));
        }

        // 3. Try lookup by farmerId e.g. "FARMER-9876543210"
        if (opt.isEmpty()) {
            opt = farmerRepository.findByFarmerId(cred);
            if (opt.isEmpty() && cleaned.length() == 10) {
                opt = farmerRepository.findByFarmerId("FARMER-" + cleaned);
            }
        }

        // 4. Try direct mobile lookup if not found yet
        if (opt.isEmpty()) {
            opt = farmerRepository.findByMobile(cred);
        }

        if (opt.isEmpty()) return Optional.empty();

        Farmer farmer = opt.get();
        // Allow demo OTP 123456 as master password for easy demonstration or match hashed password
        if ("123456".equals(password)) {
            return Optional.of(farmer);
        }

        if (farmer.getPasswordHash() != null && farmer.getPasswordHash().equals(hashPassword(password))) {
            return Optional.of(farmer);
        }

        return Optional.empty();
    }

    public Optional<Farmer> lookupByMobile(String mobile) {
        if (mobile == null || mobile.isBlank()) return Optional.empty();
        return farmerRepository.findByMobile(mobile.trim());
    }

    public Optional<Farmer> getById(UUID id) {
        return farmerRepository.findById(id);
    }

    @Transactional
    public Farmer updateProfile(UUID id, Map<String, Object> data) {
        Farmer farmer = farmerRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Farmer not found"));

        if (data.containsKey("name")) farmer.setName((String) data.get("name"));
        if (data.containsKey("address")) farmer.setAddress((String) data.get("address"));
        if (data.containsKey("state")) farmer.setState((String) data.get("state"));
        if (data.containsKey("district")) farmer.setDistrict((String) data.get("district"));
        if (data.containsKey("crop")) farmer.setCrop((String) data.get("crop"));
        if (data.containsKey("quantity") && data.get("quantity") != null) {
            farmer.setQuantity(Double.valueOf(data.get("quantity").toString()));
        }
        if (data.containsKey("bank_account")) farmer.setBankAccount((String) data.get("bank_account"));
        if (data.containsKey("ifsc")) farmer.setIfsc((String) data.get("ifsc"));
        if (data.containsKey("language")) farmer.setLanguage((String) data.get("language"));
        if (data.containsKey("password") && data.get("password") != null && !data.get("password").toString().isBlank()) {
            farmer.setPasswordHash(hashPassword(data.get("password").toString()));
        }
        if (data.containsKey("preferred_center_id") && data.get("preferred_center_id") != null) {
            try {
                farmer.setPreferredCenterId(UUID.fromString(data.get("preferred_center_id").toString()));
            } catch (Exception ignored) {}
        }

        return farmerRepository.save(farmer);
    }
}
