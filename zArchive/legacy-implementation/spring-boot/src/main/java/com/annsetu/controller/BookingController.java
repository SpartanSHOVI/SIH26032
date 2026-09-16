package com.annsetu.controller;

import com.annsetu.entity.Center;
import com.annsetu.entity.Slot;
import com.annsetu.entity.Token;
import com.annsetu.repository.CenterRepository;
import com.annsetu.repository.SlotRepository;
import com.annsetu.repository.TokenRepository;
import com.annsetu.service.BookingService;
import com.annsetu.service.CenterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping
@Tag(name = "Bookings", description = "Procurement slot booking and center availability endpoints")
public class BookingController {

    private final BookingService bookingService;
    private final CenterService centerService;
    private final TokenRepository tokenRepository;
    private final CenterRepository centerRepository;
    private final SlotRepository slotRepository;

    public BookingController(BookingService bookingService, CenterService centerService,
                             TokenRepository tokenRepository, CenterRepository centerRepository,
                             SlotRepository slotRepository) {
        this.bookingService = bookingService;
        this.centerService = centerService;
        this.tokenRepository = tokenRepository;
        this.centerRepository = centerRepository;
        this.slotRepository = slotRepository;
    }

    @GetMapping({"/bookings/centers", "/centers"})
    @Operation(summary = "Get all centers with live queue waiting counts and optional classification/search filters")
    public ResponseEntity<List<Map<String, Object>>> getCenters(
            @RequestParam(required = false) String stateCode,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String classification,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(centerService.getAllCentersWithWaiting(date, state, district, classification, search, limit));
    }

    @GetMapping({"/centers/{centerId}/slots", "/bookings/availability"})
    @Operation(summary = "Get slot availability for center and date")
    public ResponseEntity<List<Map<String, Object>>> getSlots(
            @PathVariable(required = false) String centerId,
            @RequestParam(required = false) String center_id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        String cid = centerId != null ? centerId : center_id;
        if (cid == null) {
            return ResponseEntity.badRequest().build();
        }
        UUID centerUuid = UUID.fromString(cid);
        return ResponseEntity.ok(bookingService.getSlotsForCenterAndDate(centerUuid, date));
    }

    @PostMapping({"/tokens/book", "/bookings"})
    @Operation(summary = "Create slot booking and generate token")
    public ResponseEntity<?> bookToken(@RequestBody Map<String, Object> req) {
        try {
            UUID farmerId = UUID.fromString(req.get("farmer_id").toString());
            UUID centerId = UUID.fromString(req.get("center_id").toString());
            Long slotId = Long.valueOf(req.get("slot_id").toString());
            String via = req.get("booked_via") != null ? req.get("booked_via").toString() : "app";

            Map<String, Object> result = bookingService.bookToken(farmerId, centerId, slotId, via);
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/tokens/call-book")
    @Operation(summary = "Assisted call-in booking by center staff")
    public ResponseEntity<?> callBookToken(@RequestBody Map<String, Object> req) {
        try {
            Map<String, Object> result = bookingService.callBookToken(req);
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/tokens/{tokenId}/running-late")
    @Operation(summary = "Request 15-minute slot extension")
    public ResponseEntity<?> runningLate(@PathVariable Long tokenId) {
        try {
            Map<String, Object> result = bookingService.requestRunningLate(tokenId);
            return ResponseEntity.ok(result);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/bookings/my")
    @Operation(summary = "Get bookings for farmer")
    public ResponseEntity<List<Map<String, Object>>> getMyBookings(@RequestParam(required = false) String farmerId) {
        if (farmerId == null || farmerId.isBlank()) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        List<Token> tokens;
        try {
            tokens = tokenRepository.findByFarmerIdOrderByCreatedAtDesc(UUID.fromString(farmerId.trim()));
        } catch (Exception e) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Token t : tokens) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", t.getId());
            map.put("tokenNumber", t.getTokenNumber());
            map.put("token_number", t.getTokenNumber());
            map.put("status", t.getStatus());
            map.put("farmerId", t.getFarmerId());
            map.put("centerId", t.getCenterId());
            map.put("slotId", t.getSlotId());
            map.put("quantityReceived", t.getQuantityReceived());
            map.put("rejectReason", t.getRejectReason());
            map.put("bookedVia", t.getBookedVia());
            map.put("runningLateUsed", t.getRunningLateUsed());
            map.put("paymentMethod", t.getPaymentMethod());
            map.put("paymentStatus", t.getPaymentStatus());
            map.put("paymentAmount", t.getPaymentAmount());
            map.put("transactionRef", t.getTransactionRef());
            map.put("createdAt", t.getCreatedAt().toString());

            Center center = centerRepository.findById(t.getCenterId()).orElse(null);
            if (center != null) {
                Map<String, Object> cMap = new HashMap<>();
                cMap.put("id", center.getId().toString());
                cMap.put("name", center.getName());
                cMap.put("code", center.getCode());
                cMap.put("location", center.getLocation() != null ? center.getLocation() : "");
                map.put("center", cMap);
                map.put("centerName", center.getName());
                map.put("centerCode", center.getCode());
            } else {
                map.put("center", Map.of("name", "Procurement Center", "code", ""));
                map.put("centerName", "Procurement Center");
                map.put("centerCode", "");
            }

            Slot slot = slotRepository.findById(t.getSlotId()).orElse(null);
            if (slot != null) {
                map.put("bookingDate", slot.getSlotDate().toString());
                map.put("timeWindowStart", slot.getStartTime().toString());
                map.put("timeWindowEnd", slot.getEndTime().toString());
            } else {
                map.put("bookingDate", t.getCreatedAt().toLocalDate().toString());
                map.put("timeWindowStart", "09:00");
                map.put("timeWindowEnd", "10:00");
            }
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }
}