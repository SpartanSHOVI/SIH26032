package com.annsetu.service;

import com.annsetu.entity.Center;
import com.annsetu.entity.Farmer;
import com.annsetu.entity.Slot;
import com.annsetu.entity.Token;
import com.annsetu.repository.CenterRepository;
import com.annsetu.repository.FarmerRepository;
import com.annsetu.repository.SlotRepository;
import com.annsetu.repository.TokenRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class BookingService {

    private final SlotRepository slotRepository;
    private final TokenRepository tokenRepository;
    private final CenterRepository centerRepository;
    private final FarmerRepository farmerRepository;
    private final NotificationService notificationService;
    private final RedisEventPublisher redisEventPublisher;

    public BookingService(
            SlotRepository slotRepository,
            TokenRepository tokenRepository,
            CenterRepository centerRepository,
            FarmerRepository farmerRepository,
            NotificationService notificationService,
            RedisEventPublisher redisEventPublisher) {
        this.slotRepository = slotRepository;
        this.tokenRepository = tokenRepository;
        this.centerRepository = centerRepository;
        this.farmerRepository = farmerRepository;
        this.notificationService = notificationService;
        this.redisEventPublisher = redisEventPublisher;
    }

    @Transactional
    public List<Map<String, Object>> getSlotsForCenterAndDate(UUID centerId, LocalDate date) {
        LocalDate targetDate = date != null ? date : LocalDate.now();
        List<Slot> slots = slotRepository.findByCenterIdAndSlotDateOrderByStartTimeAsc(centerId, targetDate);

        if (slots.isEmpty()) {
            Center center = centerRepository.findById(centerId)
                    .orElseThrow(() -> new IllegalArgumentException("Center not found"));
            int cap = center.getCapacityPerHour() != null ? center.getCapacityPerHour() : 25;

            List<String[]> hours = List.of(
                    new String[]{"09:00", "10:00"},
                    new String[]{"10:00", "11:00"},
                    new String[]{"11:00", "12:00"},
                    new String[]{"12:00", "13:00"},
                    new String[]{"14:00", "15:00"},
                    new String[]{"15:00", "16:00"},
                    new String[]{"16:00", "17:00"}
            );

            for (String[] h : hours) {
                Slot s = new Slot();
                s.setCenterId(centerId);
                s.setSlotDate(targetDate);
                s.setStartTime(h[0]);
                s.setEndTime(h[1]);
                s.setTotalSlots(cap);
                s.setBookedCount(0);
                slotRepository.save(s);
            }
            slots = slotRepository.findByCenterIdAndSlotDateOrderByStartTimeAsc(centerId, targetDate);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Slot s : slots) {
            int remaining = s.getTotalSlots() - s.getBookedCount();
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", s.getId());
            map.put("center_id", s.getCenterId().toString());
            map.put("date", s.getSlotDate().toString());
            map.put("slot_date", s.getSlotDate().toString());
            map.put("start_time", s.getStartTime());
            map.put("end_time", s.getEndTime());
            map.put("total_slots", s.getTotalSlots());
            map.put("booked_count", s.getBookedCount());
            map.put("remaining", Math.max(remaining, 0));
            map.put("full", remaining <= 0);
            result.add(map);
        }
        return result;
    }

    @Transactional
    public Map<String, Object> bookToken(UUID farmerId, UUID centerId, Long slotId, String via) {
        Slot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new IllegalArgumentException("Slot not found"));

        if (slot.getBookedCount() >= slot.getTotalSlots()) {
            throw new IllegalStateException("This slot is full. Please choose another slot.");
        }

        Center center = centerRepository.findById(centerId)
                .orElseThrow(() -> new IllegalArgumentException("Center not found"));

        Farmer farmer = farmerRepository.findById(farmerId)
                .orElseThrow(() -> new IllegalArgumentException("Farmer not found"));

        if (!slot.getCenterId().equals(centerId)) {
            throw new IllegalArgumentException("Selected slot does not belong to this center");
        }

        // Generate date-stamped, collision-proof token number
        String dateCompact = slot.getSlotDate().format(DateTimeFormatter.ofPattern("yyMMdd"));
        String codePrefix = center.getCode() != null && !center.getCode().isBlank() ? center.getCode() : "PC";
        long countOnSlotDate = tokenRepository.countCenterTokensByDate(centerId, slot.getSlotDate());
        long seq = 1001 + countOnSlotDate;
        String tokenNumber = String.format("%s-%s-%d", codePrefix, dateCompact, seq);

        // Deduplication safety check
        while (tokenRepository.findByTokenNumber(tokenNumber).isPresent()) {
            seq++;
            tokenNumber = String.format("%s-%s-%d", codePrefix, dateCompact, seq);
        }

        Token token = new Token();
        token.setTokenNumber(tokenNumber);
        token.setFarmerId(farmerId);
        token.setCenterId(centerId);
        token.setSlotId(slotId);
        token.setStatus("booked");
        token.setBookedVia(via != null ? via : "app");

        Token savedToken = tokenRepository.save(token);

        slot.setBookedCount(slot.getBookedCount() + 1);
        slotRepository.save(slot);

        String appMsg = String.format(
                "Appointment confirmed! Token %s at %s on %s between %s-%s.",
                tokenNumber, center.getName(), slot.getSlotDate(), slot.getStartTime(), slot.getEndTime()
        );
        String smsMsg = String.format(
                "Your procurement token is %s. Center: %s. Date: %s. Time: %s-%s.",
                tokenNumber, center.getName(), slot.getSlotDate(), slot.getStartTime(), slot.getEndTime()
        );
        String waMsg = String.format(
                "🌾 AnnSetu token %s confirmed at %s on %s (%s-%s).",
                tokenNumber, center.getName(), slot.getSlotDate(), slot.getStartTime(), slot.getEndTime()
        );

        notificationService.notifyFarmerMultiChannel(farmerId, centerId, farmer.getMobile(), appMsg, smsMsg, waMsg);

        // Publish real-time event
        redisEventPublisher.publishQueueEvent(
                "POSITION_UPDATE",
                centerId.toString(),
                farmerId.toString(),
                tokenNumber,
                "booked",
                null,
                null
        );

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("token_id", savedToken.getId());
        result.put("token_number", tokenNumber);
        result.put("date", slot.getSlotDate().toString());
        result.put("time", slot.getStartTime() + " - " + slot.getEndTime());
        result.put("center", center.getName());
        result.put("farmer", farmer.getName());
        result.put("farmer_mobile", farmer.getMobile());
        return result;
    }

    @Transactional
    public Map<String, Object> callBookToken(Map<String, Object> req) {
        String name = (String) req.get("name");
        String mobile = req.get("mobile") != null ? req.get("mobile").toString().trim() : null;
        String location = (String) req.get("location");
        String crop = (String) req.get("crop");
        Double quantity = req.get("quantity") != null ? Double.valueOf(req.get("quantity").toString()) : null;

        UUID centerId = UUID.fromString(req.get("center_id").toString());
        Long slotId = Long.valueOf(req.get("slot_id").toString());

        Farmer farmer = farmerRepository.findByMobile(mobile).orElseGet(() -> {
            Farmer f = new Farmer();
            f.setName(name);
            f.setMobile(mobile);
            f.setFarmerId("FARMER-" + mobile);
            f.setAddress(location);
            f.setCrop(crop);
            f.setQuantity(quantity);
            f.setPreferredCenterId(centerId);
            return farmerRepository.save(f);
        });

        Map<String, Object> bookingResult = bookToken(farmer.getId(), centerId, slotId, "call");
        bookingResult.put("farmer_id", farmer.getId().toString());
        bookingResult.put("sms_sent", String.format(
                "SMS to %s: Your token %s is booked for %s %s at %s.",
                farmer.getMobile(), bookingResult.get("token_number"),
                bookingResult.get("date"), bookingResult.get("time"), bookingResult.get("center")
        ));
        return bookingResult;
    }

    @Transactional
    public Map<String, Object> requestRunningLate(Long tokenId) {
        Token token = tokenRepository.findById(tokenId)
                .orElseThrow(() -> new IllegalArgumentException("Token not found"));

        if (Boolean.TRUE.equals(token.getRunningLateUsed())) {
            throw new IllegalStateException("Running late extension has already been used for this token.");
        }

        List<String> validStatuses = List.of("booked", "arrived", "verification", "quality_check");
        if (!validStatuses.contains(token.getStatus())) {
            throw new IllegalStateException("Cannot extend slot for current token status: " + token.getStatus());
        }

        Slot slot = slotRepository.findById(token.getSlotId())
                .orElseThrow(() -> new IllegalArgumentException("Slot not found"));

        // Calculate individual arrival grace period (+15 mins) WITHOUT mutating the shared Slot for other farmers
        String extendedTimeStr;
        try {
            LocalTime currentEnd = LocalTime.parse(slot.getEndTime(), DateTimeFormatter.ofPattern("HH:mm"));
            extendedTimeStr = currentEnd.plusMinutes(15).format(DateTimeFormatter.ofPattern("HH:mm"));
        } catch (Exception e) {
            extendedTimeStr = "Extended (+15 mins)";
        }

        token.setRunningLateUsed(true);
        tokenRepository.save(token);

        String notifMsg = String.format(
                "Grace period granted! Arrival window for token %s extended to %s (+15m). Center gate operators have been advised.",
                token.getTokenNumber(), extendedTimeStr
        );
        notificationService.pushNotification(token.getFarmerId(), notifMsg);

        Map<String, Object> res = new HashMap<>();
        res.put("message", "Arrival window extended by 15 minutes.");
        res.put("token_number", token.getTokenNumber());
        res.put("slot_start", slot.getStartTime());
        res.put("slot_end", slot.getEndTime());
        res.put("grace_until", extendedTimeStr);
        return res;
    }
}
