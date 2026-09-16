package com.annsetu.service;

import com.annsetu.entity.*;
import com.annsetu.repository.*;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.util.*;

@Service
public class QueueService {

    public static final List<String> STATUS_FLOW = List.of(
            "booked",
            "arrived",
            "verification",
            "quality_check",
            "accepted",
            "procured",
            "payment_processing",
            "payment_completed"
    );

    private final TokenRepository tokenRepository;
    private final CenterRepository centerRepository;
    private final FarmerRepository farmerRepository;
    private final SlotRepository slotRepository;
    private final NotificationRepository notificationRepository;

    public QueueService(
            TokenRepository tokenRepository,
            CenterRepository centerRepository,
            FarmerRepository farmerRepository,
            SlotRepository slotRepository,
            NotificationRepository notificationRepository) {
        this.tokenRepository = tokenRepository;
        this.centerRepository = centerRepository;
        this.farmerRepository = farmerRepository;
        this.slotRepository = slotRepository;
        this.notificationRepository = notificationRepository;
    }

    public Map<String, Object> getTokenDetails(Long tokenId) {
        Token token = tokenRepository.findById(tokenId)
                .orElseThrow(() -> new IllegalArgumentException("Token not found"));
        return buildTokenDetailMap(token);
    }

    public Optional<Map<String, Object>> lookupToken(String query) {
        if (query == null || query.isBlank()) return Optional.empty();
        String q = query.trim();

        // Check if query is token number
        Optional<Token> byNumber = tokenRepository.findByTokenNumber(q);
        if (byNumber.isPresent()) {
            return Optional.of(buildTokenDetailMap(byNumber.get()));
        }

        // Check if query is mobile number
        Optional<Farmer> byMobile = farmerRepository.findByMobile(q);
        if (byMobile.isPresent()) {
            List<Token> tokens = tokenRepository.findByFarmerIdOrderByCreatedAtDesc(byMobile.get().getId());
            if (!tokens.isEmpty()) {
                return Optional.of(buildTokenDetailMap(tokens.get(0)));
            }
        }

        return Optional.empty();
    }

    public Map<String, Object> buildTokenDetailMap(Token token) {
        Center center = centerRepository.findById(token.getCenterId()).orElse(null);
        Farmer farmer = farmerRepository.findById(token.getFarmerId()).orElse(null);
        Slot slot = slotRepository.findById(token.getSlotId()).orElse(null);

        LocalDate slotDate = slot != null ? slot.getSlotDate() : LocalDate.now();
        String startTime = slot != null && slot.getStartTime() != null ? slot.getStartTime() : "09:00";

        // Check if token has completed or been rejected
        boolean isFinished = token.getStatus() != null &&
                List.of("procured", "payment_processing", "payment_completed", "rejected")
                        .contains(token.getStatus().toLowerCase());

        long ahead = 0;
        long estWaitMin = 0;
        double dynamicAvgMin = center != null && center.getAvgProcessingMin() != null ? center.getAvgProcessingMin() : 7.0;
        int counters = center != null && center.getCounters() != null ? Math.max(center.getCounters(), 1) : 2;

        if (!isFinished) {
            // 1. Calculate how many active farmers are scheduled ahead
            ahead = tokenRepository.countFarmersAhead(token.getCenterId(), slotDate, startTime, token.getCreatedAt());

            // 2. Dynamic rolling average processing time from last 20 completed tokens
            List<Token> completedTokens = tokenRepository.findLast20CompletedTokens(token.getCenterId(), slotDate);
            if (!completedTokens.isEmpty()) {
                List<Long> durations = new ArrayList<>();
                for (Token t : completedTokens) {
                    if (t.getCreatedAt() != null && t.getUpdatedAt() != null) {
                        long minutes = Duration.between(t.getCreatedAt(), t.getUpdatedAt()).toMinutes();
                        if (minutes > 0 && minutes < 120) {
                            durations.add(minutes);
                        }
                    }
                }
                if (!durations.isEmpty()) {
                    dynamicAvgMin = durations.stream().mapToLong(d -> d != null ? d : 0L).average().orElse(dynamicAvgMin);
                }
            }

            if ("verification".equalsIgnoreCase(token.getStatus()) || "quality_check".equalsIgnoreCase(token.getStatus())) {
                estWaitMin = 0; // Currently at counter
            } else if (ahead == 0) {
                estWaitMin = 3; // Next in line
            } else {
                estWaitMin = Math.max(3, Math.round((ahead * dynamicAvgMin) / counters));
            }
        }

        // 3. Currently serving token
        String currentServing = tokenRepository.findCurrentServingToken(token.getCenterId(), slotDate)
                .orElse("—");

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", token.getId());
        map.put("token_id", token.getId());
        map.put("token_number", token.getTokenNumber());
        map.put("status", token.getStatus());
        map.put("reject_reason", token.getRejectReason());
        map.put("quantity_received", token.getQuantityReceived());
        map.put("booked_via", token.getBookedVia());
        map.put("running_late_used", Boolean.TRUE.equals(token.getRunningLateUsed()));
        map.put("payment_method", token.getPaymentMethod());
        map.put("payment_status", token.getPaymentStatus());
        map.put("payment_amount", token.getPaymentAmount());
        map.put("transaction_ref", token.getTransactionRef());
        map.put("payment_at", token.getPaymentAt() != null ? token.getPaymentAt().toString() : null);
        map.put("created_at", token.getCreatedAt().toString());

        map.put("farmer_id", farmer != null ? farmer.getId().toString() : null);
        map.put("farmer_name", farmer != null ? farmer.getName() : "—");
        map.put("mobile", farmer != null ? farmer.getMobile() : "—");
        map.put("crop", farmer != null ? farmer.getCrop() : "—");
        map.put("quantity", farmer != null ? farmer.getQuantity() : 0.0);
        map.put("bank_account", farmer != null ? farmer.getBankAccount() : null);
        map.put("ifsc", farmer != null ? farmer.getIfsc() : null);

        map.put("center_id", center != null ? center.getId().toString() : null);
        map.put("center_name", center != null ? center.getName() : "—");
        map.put("center_location", center != null ? center.getLocation() : "—");
        map.put("counters", counters);
        map.put("avg_processing_min", dynamicAvgMin);

        map.put("slot_id", slot != null ? slot.getId() : null);
        map.put("date", slotDate.toString());
        map.put("start_time", slot != null ? slot.getStartTime() : "—");
        map.put("end_time", slot != null ? slot.getEndTime() : "—");

        map.put("farmers_ahead", ahead);
        map.put("current_token", currentServing);
        map.put("estimated_wait_min", estWaitMin);
        map.put("status_flow", STATUS_FLOW);

        if (farmer != null) {
            List<Notification> notifs = notificationRepository.findTop20ByFarmerIdOrderByCreatedAtDesc(farmer.getId());
            List<Map<String, Object>> notifList = new ArrayList<>();
            for (Notification n : notifs) {
                Map<String, Object> nm = new HashMap<>();
                nm.put("message", n.getMessage());
                nm.put("channel", n.getChannel());
                nm.put("notification_type", n.getNotificationType());
                nm.put("created_at", n.getCreatedAt().toString());
                notifList.add(nm);
            }
            map.put("notifications", notifList);
        } else {
            map.put("notifications", List.of());
        }

        return map;
    }
}
