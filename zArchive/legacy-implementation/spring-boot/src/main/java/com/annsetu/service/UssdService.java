package com.annsetu.service;

import com.annsetu.entity.Farmer;
import com.annsetu.entity.Slot;
import com.annsetu.entity.Token;
import com.annsetu.repository.CenterRepository;
import com.annsetu.repository.FarmerRepository;
import com.annsetu.repository.SlotRepository;
import com.annsetu.repository.TokenRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class UssdService {

    private final FarmerRepository farmerRepository;
    private final TokenRepository tokenRepository;
    private final SlotRepository slotRepository;
    private final CenterRepository centerRepository;
    private final BookingService bookingService;
    private final NotificationService notificationService;

    public UssdService(
            FarmerRepository farmerRepository,
            TokenRepository tokenRepository,
            SlotRepository slotRepository,
            CenterRepository centerRepository,
            BookingService bookingService,
            NotificationService notificationService) {
        this.farmerRepository = farmerRepository;
        this.tokenRepository = tokenRepository;
        this.slotRepository = slotRepository;
        this.centerRepository = centerRepository;
        this.bookingService = bookingService;
        this.notificationService = notificationService;
    }

    /**
     * Process USSD requests following GSM 03.90 telecom standard.
     * Response prefixed with "CON " prompts the phone for further input.
     * Response prefixed with "END " terminates the session with final output.
     */
    public String processUssd(String sessionId, String serviceCode, String phoneNumber, String text) {
        String input = (text != null) ? text.trim() : "";
        String[] parts = input.isEmpty() ? new String[0] : input.split("\\*");

        // Lookup farmer by phone number if registered
        Optional<Farmer> farmerOpt = farmerRepository.findByMobile(phoneNumber != null ? phoneNumber.trim() : "");
        String farmerName = farmerOpt.isPresent() && farmerOpt.get().getName() != null ? farmerOpt.get().getName() : "Kisan";

        // 1. Initial Root Menu (*555#)
        if (parts.length == 0) {
            return "CON AnnSetu Kisan Seva (*555#)\n" +
                    "Namaste " + farmerName + "!\n" +
                    "1. Live Token & Queue Status\n" +
                    "2. Book Procurement Slot\n" +
                    "3. Running Late (+15m Grace)\n" +
                    "4. Today's Mandi MSP Rates\n" +
                    "5. Toll-Free Helpline Info";
        }

        String mainChoice = parts[0];

        switch (mainChoice) {
            case "1":
                return handleQueueStatus(farmerOpt, parts, phoneNumber);
            case "2":
                return handleSlotBooking(farmerOpt, parts, phoneNumber);
            case "3":
                return handleRunningLate(farmerOpt, parts, phoneNumber);
            case "4":
                return handleMspRates(parts);
            case "5":
                return "END AnnSetu 24x7 Kisan Helpline:\n" +
                        "Toll-Free: 1800-180-SETU (7388)\n" +
                        "Language Support: Hindi, Punjabi, Marathi, English\n" +
                        "APMC Hours: 09:00 - 17:00\n" +
                        "Free service for all farmers.";
            default:
                return "END Invalid option selected. Please redial *555#.";
        }
    }

    private String handleQueueStatus(Optional<Farmer> farmerOpt, String[] parts, String phoneNumber) {
        if (farmerOpt.isEmpty()) {
            if (parts.length == 1) {
                return "CON Mobile not registered.\nEnter your Token Number (e.g. CTA1001):";
            }
            String tokenNumber = parts[1].trim().toUpperCase();
            Optional<Token> tokenOpt = tokenRepository.findByTokenNumber(tokenNumber);
            if (tokenOpt.isEmpty()) {
                return "END Token " + tokenNumber + " not found. Please verify and retry.";
            }
            return formatTokenStatus(tokenOpt.get());
        }

        Farmer farmer = farmerOpt.get();
        LocalDate today = LocalDate.now();
        List<Token> allTokens = tokenRepository.findByFarmerIdOrderByCreatedAtDesc(farmer.getId());
        List<Token> todayTokens = allTokens.stream().filter(t -> {
            Slot s = slotRepository.findById(t.getSlotId()).orElse(null);
            return s != null && today.equals(s.getSlotDate());
        }).toList();

        if (todayTokens.isEmpty()) {
            if (allTokens.isEmpty()) {
                return "END No active procurement tokens found for " + farmer.getName() + ".\nDial *555*2# to book a slot.";
            }
            return formatTokenStatus(allTokens.get(0));
        }

        return formatTokenStatus(todayTokens.get(0));
    }

    private String formatTokenStatus(Token token) {
        Slot slot = slotRepository.findById(token.getSlotId()).orElse(null);
        String centerName = centerRepository.findById(token.getCenterId())
                .map(c -> c.getName() != null ? c.getName() : c.getCode())
                .orElse("APMC Mandi");

        long ahead = 0;
        int waitMin = 0;
        if (slot != null && !"procured".equalsIgnoreCase(token.getStatus()) && !"rejected".equalsIgnoreCase(token.getStatus())) {
            ahead = tokenRepository.countFarmersAhead(token.getCenterId(), slot.getSlotDate(), slot.getStartTime(), token.getCreatedAt());
            waitMin = (int) Math.max(3, (ahead * 7) / 2);
        }

        String statusDisplay = token.getStatus().toUpperCase().replace("_", " ");
        String arrivalWindow = (slot != null) ? slot.getStartTime() + "-" + slot.getEndTime() : "09:00-10:00";

        // Log USSD event
        notificationService.logMessage(token.getFarmerId(), token.getCenterId(), "USSD", token.getTokenNumber(),
                "USSD Query for Token " + token.getTokenNumber() + ": Status " + statusDisplay + ", Ahead: " + ahead);

        return "END [AnnSetu Token: " + token.getTokenNumber() + "]\n" +
                "Mandi: " + centerName + "\n" +
                "Status: " + statusDisplay + "\n" +
                "Window: " + arrivalWindow + "\n" +
                "Farmers Ahead: " + ahead + "\n" +
                "Est. Wait: ~" + waitMin + " mins\n" +
                "Dial *555*3# if delayed.";
    }

    private String handleSlotBooking(Optional<Farmer> farmerOpt, String[] parts, String phoneNumber) {
        if (farmerOpt.isEmpty()) {
            return "END Your mobile " + phoneNumber + " is not registered.\nPlease visit nearest APMC Center or call 1800-180-SETU.";
        }
        Farmer farmer = farmerOpt.get();

        // Step 1: Select Date
        if (parts.length == 1) {
            LocalDate today = LocalDate.now();
            LocalDate tomorrow = today.plusDays(1);
            return "CON Book APMC Slot for " + (farmer.getCrop() != null ? farmer.getCrop() : "Produce") + ":\n" +
                    "1. Today (" + today.format(DateTimeFormatter.ofPattern("dd-MMM")) + ")\n" +
                    "2. Tomorrow (" + tomorrow.format(DateTimeFormatter.ofPattern("dd-MMM")) + ")\n" +
                    "0. Cancel";
        }

        String dateChoice = parts[1];
        if ("0".equals(dateChoice)) return "END Booking cancelled.";
        LocalDate targetDate = "2".equals(dateChoice) ? LocalDate.now().plusDays(1) : LocalDate.now();

        // Step 2: Select Time Window
        if (parts.length == 2) {
            return "CON Select Time Window for " + targetDate.format(DateTimeFormatter.ofPattern("dd-MMM")) + ":\n" +
                    "1. Morning (09:00 - 10:00)\n" +
                    "2. Morning (10:00 - 11:00)\n" +
                    "3. Noon (11:00 - 12:00)\n" +
                    "4. Afternoon (12:00 - 13:00)\n" +
                    "5. Evening (14:00 - 15:00)";
        }

        String timeChoice = parts[2];
        String startTime = "09:00";
        String endTime = "10:00";
        switch (timeChoice) {
            case "2": startTime = "10:00"; endTime = "11:00"; break;
            case "3": startTime = "11:00"; endTime = "12:00"; break;
            case "4": startTime = "12:00"; endTime = "13:00"; break;
            case "5": startTime = "14:00"; endTime = "15:00"; break;
        }

        // Determine Center
        final UUID finalCenterId = (farmer.getPreferredCenterId() != null)
                ? farmer.getPreferredCenterId()
                : centerRepository.findAll().stream().findFirst().map(c -> c.getId()).orElse(null);

        if (finalCenterId == null) {
            return "END No active procurement center found. Call 1800-180-SETU for assistance.";
        }

        final String finalStartTime = startTime;
        final String finalEndTime = endTime;

        // Find or create slot
        Slot slot = slotRepository.findByCenterIdAndSlotDateAndStartTime(finalCenterId, targetDate, finalStartTime)
                .orElseGet(() -> {
                    Slot newSlot = new Slot();
                    newSlot.setCenterId(finalCenterId);
                    newSlot.setSlotDate(targetDate);
                    newSlot.setStartTime(finalStartTime);
                    newSlot.setEndTime(finalEndTime);
                    newSlot.setTotalSlots(25);
                    newSlot.setBookedCount(0);
                    return slotRepository.save(newSlot);
                });

        try {
            var result = bookingService.bookToken(farmer.getId(), finalCenterId, slot.getId(), "ussd");
            String tokenNum = result.get("token_number").toString();

            notificationService.logMessage(farmer.getId(), finalCenterId, "USSD", phoneNumber,
                    "USSD Slot Confirmed: Token " + tokenNum + " on " + targetDate + " at " + startTime);

            return "END [Slot Booked Successfully!]\n" +
                    "Token: " + tokenNum + "\n" +
                    "Date: " + targetDate + "\n" +
                    "Time: " + startTime + " - " + endTime + "\n" +
                    "Produce: " + (farmer.getCrop() != null ? farmer.getCrop() : "Wheat") + "\n" +
                    "Confirmation SMS dispatched to your phone.";
        } catch (Exception e) {
            return "END Booking failed: " + e.getMessage() + ". Please retry or call 1800-180-SETU.";
        }
    }

    private String handleRunningLate(Optional<Farmer> farmerOpt, String[] parts, String phoneNumber) {
        if (farmerOpt.isEmpty()) {
            return "END Mobile not registered. Please call 1800-180-SETU.";
        }
        Farmer farmer = farmerOpt.get();
        List<Token> allTokens = tokenRepository.findByFarmerIdOrderByCreatedAtDesc(farmer.getId());
        List<Token> todayTokens = allTokens.stream().filter(t -> {
            Slot s = slotRepository.findById(t.getSlotId()).orElse(null);
            return s != null && LocalDate.now().equals(s.getSlotDate());
        }).toList();

        if (todayTokens.isEmpty()) {
            return "END No active bookings found for today to request late arrival.";
        }

        Token token = todayTokens.get(0);
        if (Boolean.TRUE.equals(token.getRunningLateUsed())) {
            return "END 15-minute grace period already utilized for Token " + token.getTokenNumber() + ". Please arrive promptly.";
        }

        try {
            var result = bookingService.requestRunningLate(token.getId());
            String graceUntil = result.get("grace_until") != null ? result.get("grace_until").toString() : "Extended";

            notificationService.logMessage(farmer.getId(), token.getCenterId(), "USSD", phoneNumber,
                    "USSD Grace Period Approved for Token " + token.getTokenNumber() + " until " + graceUntil);

            return "END [15-Min Grace Window Approved]\n" +
                    "Token: " + token.getTokenNumber() + "\n" +
                    "Extended Until: " + graceUntil + "\n" +
                    "Queue rank preserved. Gate notified.";
        } catch (Exception e) {
            return "END Request error: " + e.getMessage();
        }
    }

    private String handleMspRates(String[] parts) {
        return "CON Current Govt MSP Rates (Rs/Quintal):\n" +
                "1. Wheat (गेहूं): Rs 2,275\n" +
                "2. Paddy / Rice (धान): Rs 2,183\n" +
                "3. Mustard (सरसों): Rs 5,650\n" +
                "4. Chana / Gram (चना): Rs 5,440\n" +
                "5. Soybean (सोयाबीन): Rs 4,600\n" +
                "0. Exit";
    }
}
