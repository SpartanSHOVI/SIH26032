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
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class IvrService {

    private final FarmerRepository farmerRepository;
    private final TokenRepository tokenRepository;
    private final SlotRepository slotRepository;
    private final CenterRepository centerRepository;
    private final BookingService bookingService;
    private final NotificationService notificationService;

    public IvrService(
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
     * Handles inbound IVR phone call to 1800-180-SETU (7388)
     */
    public Map<String, Object> handleIncomingCall(String callerPhone, String digits, String lang) {
        String language = (lang != null && !lang.isBlank()) ? lang.toLowerCase() : "hi";
        String input = (digits != null) ? digits.trim() : "";

        Optional<Farmer> farmerOpt = farmerRepository.findByMobile(callerPhone != null ? callerPhone.trim() : "");
        String farmerName = farmerOpt.isPresent() && farmerOpt.get().getName() != null ? farmerOpt.get().getName() : "किसान भाई";

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("helpline_number", "1800-180-SETU (7388)");
        response.put("caller_phone", callerPhone);
        response.put("language", language);

        // Step 1: Initial language selection if no digits yet
        if (input.isEmpty()) {
            response.put("step", "LANGUAGE_SELECTION");
            response.put("audio_speech",
                    "अन्न सेतु राष्ट्रीय किसान हेल्पलाइन में आपका स्वागत है। " +
                    "हिंदी के लिए 1 दबाएं। " +
                    "ਪੰਜਾਬੀ ਲਈ 2 ਦਬਾਓ। " +
                    "मराठीसाठी 3 दाबा। " +
                    "For English, press 4.");
            response.put("allowed_keys", List.of("1", "2", "3", "4"));
            return response;
        }

        // Handle language change if single digit 1-4 from initial greeting
        if (input.length() == 1 && ("1".equals(input) || "2".equals(input) || "3".equals(input) || "4".equals(input))) {
            switch (input) {
                case "2": language = "pa"; break;
                case "3": language = "mr"; break;
                case "4": language = "en"; break;
                default: language = "hi"; break;
            }
            response.put("language", language);
            response.put("step", "MAIN_MENU");
            response.put("audio_speech", getMainMenuPrompt(farmerName, language));
            response.put("allowed_keys", List.of("1", "2", "3", "4", "9"));
            return response;
        }

        // Main Menu Selections (e.g. "1*1" or direct menu keys)
        String menuKey = input.contains("*") ? input.substring(input.lastIndexOf("*") + 1) : input;

        switch (menuKey) {
            case "1":
                return handleVoiceQueueStatus(farmerOpt, language, callerPhone);
            case "2":
                return handleVoiceSlotBooking(farmerOpt, language, callerPhone);
            case "3":
                return handleVoiceRunningLate(farmerOpt, language, callerPhone);
            case "4":
                return handleVoiceMspRates(language);
            case "9":
                response.put("step", "AGENT_CONNECT");
                response.put("audio_speech", getAgentConnectPrompt(language));
                response.put("connected_agent", "APMC Helpdesk Officer (Ext 104)");
                response.put("status", "CALL_FORWARDED");
                return response;
            default:
                response.put("step", "MAIN_MENU");
                response.put("audio_speech", "गलत बटन दबाया गया है। " + getMainMenuPrompt(farmerName, language));
                return response;
        }
    }

    private String getMainMenuPrompt(String farmerName, String lang) {
        switch (lang) {
            case "pa":
                return "ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ " + farmerName + " ਜੀ। " +
                        "ਆਪਣੇ ਟੋਕਨ ਅਤੇ ਮੰਡੀ ਲਾਈਨ ਦੀ ਲਾਈਵ ਸਥਿਤੀ ਜਾਣਨ ਲਈ 1 ਦਬਾਓ। " +
                        "ਨਵਾਂ ਸਲਾਟ ਬੁੱਕ ਕਰਨ ਲਈ 2 ਦਬਾਓ। " +
                        "ਜੇਕਰ ਦੇਰ ਹੋ ਰਹੀ ਹੈ ਅਤੇ 15 ਮਿੰਟ ਦੀ ਛੋਟ ਚਾਹੁੰਦੇ ਹੋ ਤਾਂ 3 ਦਬਾਓ। " +
                        "ਅੱਜ ਦਾ ਸਰਕਾਰੀ ਐਮਐਸਪੀ ਜਾਣਨ ਲਈ 4 ਦਬਾਓ। " +
                        "ਮੰਡੀ ਅਧਿਕਾਰੀ ਨਾਲ ਗੱਲ ਕਰਨ ਲਈ 9 ਦਬਾਓ।";
            case "mr":
                return "नमस्कार " + farmerName + " जी. " +
                        "आपल्या टोकन आणि थेट रांगेची स्थिती जाणून घेण्यासाठी 1 दाबा. " +
                        "नवीन स्लॉट बुक करण्यासाठी 2 दाबा. " +
                        "उशीर होत असल्यास 15 मिनिटांची सवलत मिळवण्यासाठी 3 दाबा. " +
                        "आजचे हमीभाव म्हणजेच एमएसपी जाणून घेण्यासाठी 4 दाबा. " +
                        "मंडी अधिकाऱ्याशी बोलण्यासाठी 9 दाबा.";
            case "en":
                return "Welcome " + farmerName + ". " +
                        "Press 1 for live token and queue status. " +
                        "Press 2 to book a procurement slot. " +
                        "Press 3 for a 15-minute late arrival grace period. " +
                        "Press 4 for current statutory MSP rates. " +
                        "Press 9 to speak with our Mandi Helpdesk Officer.";
            default: // Hindi
                return "नमस्ते " + farmerName + " जी। " +
                        "अपने टोकन और मंडी लाइन की लाइव स्थिति जानने के लिए 1 दबाएं। " +
                        "नया खरीद स्लॉट बुक करने के लिए 2 दबाएं। " +
                        "यदि आपको मंडी पहुंचने में देरी हो रही है और 15 मिनट की छूट चाहिए तो 3 दबाएं। " +
                        "आज के सरकारी न्यूनतम समर्थन मूल्य यानी एमएसपी जानने के लिए 4 दबाएं। " +
                        "मंडी सहायता अधिकारी से बात करने के लिए 9 दबाएं।";
        }
    }

    private Map<String, Object> handleVoiceQueueStatus(Optional<Farmer> farmerOpt, String lang, String callerPhone) {
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("step", "TOKEN_STATUS");

        if (farmerOpt.isEmpty()) {
            res.put("audio_speech", "आपका मोबाइल नंबर पंजीकृत नहीं है। कृपया नजदीकी मंडी में जाकर पंजीकरण कराएं।");
            return res;
        }

        Farmer farmer = farmerOpt.get();
        List<Token> allTokens = tokenRepository.findByFarmerIdOrderByCreatedAtDesc(farmer.getId());
        List<Token> tokens = allTokens.stream().filter(t -> {
            Slot s = slotRepository.findById(t.getSlotId()).orElse(null);
            return s != null && LocalDate.now().equals(s.getSlotDate());
        }).toList();
        if (tokens.isEmpty()) {
            tokens = allTokens;
        }

        if (tokens.isEmpty()) {
            res.put("audio_speech", "आपके नाम पर आज कोई सक्रिय टोकन नहीं है। नया स्लॉट बुक करने के लिए 2 दबाएं।");
            return res;
        }

        Token token = tokens.get(0);
        Slot slot = slotRepository.findById(token.getSlotId()).orElse(null);
        String centerName = centerRepository.findById(token.getCenterId())
                .map(c -> c.getName() != null ? c.getName() : c.getCode())
                .orElse("मंडी केंद्र");

        long ahead = 0;
        int waitMin = 0;
        if (slot != null && !"procured".equalsIgnoreCase(token.getStatus()) && !"rejected".equalsIgnoreCase(token.getStatus())) {
            ahead = tokenRepository.countFarmersAhead(token.getCenterId(), slot.getSlotDate(), slot.getStartTime(), token.getCreatedAt());
            waitMin = (int) Math.max(3, (ahead * 7) / 2);
        }

        String speech;
        if ("pa".equals(lang)) {
            speech = "ਤੁਹਾਡਾ ਟੋਕਨ ਨੰਬਰ " + token.getTokenNumber() + " ਹੈ। " +
                    "ਮੰਡੀ " + centerName + " ਵਿਖੇ ਤੁਹਾਡੇ ਤੋਂ ਅੱਗੇ " + ahead + " ਕਿਸਾਨ ਹਨ। " +
                    "ਅੰਦਾਜ਼ਨ ਇੰਤਜ਼ਾਰ ਦਾ ਸਮਾਂ ਲਗਭਗ " + waitMin + " ਮਿੰਟ ਹੈ। " +
                    "ਤੁਹਾਡੀ ਮੌਜੂਦਾ ਸਥਿਤੀ " + token.getStatus() + " ਹੈ।";
        } else if ("mr".equals(lang)) {
            speech = "आपला टोकन क्रमांक " + token.getTokenNumber() + " आहे. " +
                    centerName + " मंडीमध्ये आपल्या पुढे " + ahead + " शेतकरी आहेत. " +
                    "अंदाजे वेळ सुमारे " + waitMin + " मिनिटे आहे. " +
                    "आपली सद्य स्थिती " + token.getStatus() + " आहे.";
        } else if ("en".equals(lang)) {
            speech = "Your token number is " + token.getTokenNumber() + ". " +
                    "At " + centerName + ", there are " + ahead + " farmers ahead of you. " +
                    "Estimated waiting time is approximately " + waitMin + " minutes. " +
                    "Current status is " + token.getStatus() + ".";
        } else {
            speech = "आपका टोकन नंबर " + token.getTokenNumber() + " है। " +
                    centerName + " में आपके आगे " + ahead + " किसान हैं। " +
                    "अनुमानित प्रतीक्षा समय लगभग " + waitMin + " मिनट है। " +
                    "आपकी स्थिति " + token.getStatus() + " है। कृपया समय पर पहुंचें।";
        }

        notificationService.logMessage(farmer.getId(), token.getCenterId(), "IVR_CALL", callerPhone,
                "IVR Helpline Call: Status for Token " + token.getTokenNumber() + " - Ahead: " + ahead + ", Wait: " + waitMin + "m");

        res.put("token_number", token.getTokenNumber());
        res.put("center_name", centerName);
        res.put("farmers_ahead", ahead);
        res.put("wait_minutes", waitMin);
        res.put("status", token.getStatus());
        res.put("audio_speech", speech);
        return res;
    }

    private Map<String, Object> handleVoiceSlotBooking(Optional<Farmer> farmerOpt, String lang, String callerPhone) {
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("step", "SLOT_BOOKED");

        if (farmerOpt.isEmpty()) {
            res.put("audio_speech", "आपका नंबर पंजीकृत नहीं है। फोन द्वारा स्लॉट बुक करने के लिए कृपया अपना आधार लिंक कराएं।");
            return res;
        }

        Farmer farmer = farmerOpt.get();
        final UUID finalCenterId = (farmer.getPreferredCenterId() != null)
                ? farmer.getPreferredCenterId()
                : centerRepository.findAll().stream().findFirst().map(c -> c.getId()).orElse(null);

        if (finalCenterId == null) {
            res.put("audio_speech", "कोई सक्रिय खरीद केंद्र उपलब्ध नहीं है।");
            return res;
        }

        LocalDate targetDate = LocalDate.now().plusDays(1);
        String startTime = "09:00";
        String endTime = "10:00";

        Slot slot = slotRepository.findByCenterIdAndSlotDateAndStartTime(finalCenterId, targetDate, startTime)
                .orElseGet(() -> {
                    Slot newSlot = new Slot();
                    newSlot.setCenterId(finalCenterId);
                    newSlot.setSlotDate(targetDate);
                    newSlot.setStartTime(startTime);
                    newSlot.setEndTime(endTime);
                    newSlot.setTotalSlots(25);
                    newSlot.setBookedCount(0);
                    return slotRepository.save(newSlot);
                });

        try {
            var booking = bookingService.bookToken(farmer.getId(), finalCenterId, slot.getId(), "ivr_helpline");
            String tokenNum = booking.get("token_number").toString();

            notificationService.logMessage(farmer.getId(), finalCenterId, "IVR_CALL", callerPhone,
                    "IVR Slot Booked: Token " + tokenNum + " for " + targetDate);

            String speech = "बधाई हो " + farmer.getName() + " जी! " +
                    "कल के लिए आपका स्लॉट बुक हो गया है। आपका टोकन नंबर है " + tokenNum + "। " +
                    "समय है सुबह 9 से 10 बजे के बीच। आपके फोन पर एसएमएस भेज दिया गया है।";

            res.put("token_number", tokenNum);
            res.put("date", targetDate.toString());
            res.put("audio_speech", speech);
            return res;
        } catch (Exception e) {
            res.put("audio_speech", "क्षमा करें, स्लॉट बुकिंग में त्रुटि हुई: " + e.getMessage());
            return res;
        }
    }

    private Map<String, Object> handleVoiceRunningLate(Optional<Farmer> farmerOpt, String lang, String callerPhone) {
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("step", "GRACE_EXTENDED");

        if (farmerOpt.isEmpty()) {
            res.put("audio_speech", "आपका नंबर नहीं मिला। कृपया मंडी हेल्पलाइन से संपर्क करें।");
            return res;
        }

        Farmer farmer = farmerOpt.get();
        List<Token> allTokens = tokenRepository.findByFarmerIdOrderByCreatedAtDesc(farmer.getId());
        List<Token> todayTokens = allTokens.stream().filter(t -> {
            Slot s = slotRepository.findById(t.getSlotId()).orElse(null);
            return s != null && LocalDate.now().equals(s.getSlotDate());
        }).toList();
        if (todayTokens.isEmpty()) {
            res.put("audio_speech", "आज की तारीख में आपका कोई सक्रिय टोकन नहीं मिला।");
            return res;
        }

        Token token = todayTokens.get(0);
        try {
            var result = bookingService.requestRunningLate(token.getId());
            String graceUntil = result.get("grace_until") != null ? result.get("grace_until").toString() : "15 मिनट";

            notificationService.logMessage(farmer.getId(), token.getCenterId(), "IVR_CALL", callerPhone,
                    "IVR Grace Extension for Token " + token.getTokenNumber());

            String speech = "आपकी 15 मिनट की छूट स्वीकार कर ली गई है। " +
                    "अब आप " + graceUntil + " बजे तक मंडी में प्रवेश कर सकते हैं। आपकी कतार स्थिति सुरक्षित है।";

            res.put("audio_speech", speech);
            res.put("grace_until", graceUntil);
            return res;
        } catch (Exception e) {
            res.put("audio_speech", "छूट पहले ही ली जा चुकी है या त्रुटि: " + e.getMessage());
            return res;
        }
    }

    private Map<String, Object> handleVoiceMspRates(String lang) {
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("step", "MSP_RATES");
        String speech;
        if ("pa".equals(lang)) {
            speech = "ਭਾਰਤ ਸਰਕਾਰ ਵੱਲੋਂ ਮੌਜੂਦਾ ਸਰਕਾਰੀ ਐਮਐਸਪੀ ਦਰਾਂ ਹਨ: " +
                    "ਕਣਕ 2275 ਰੁਪਏ ਪ੍ਰਤੀ ਕੁਇੰਟਲ। " +
                    "ਝੋਨਾ 2183 ਰੁਪਏ ਪ੍ਰਤੀ ਕੁਇੰਟਲ। " +
                    "ਸਰ੍ਹੋਂ 5650 ਰੁਪਏ ਪ੍ਰਤੀ ਕੁਇੰਟਲ। " +
                    "ਚਨਾ 5440 ਰੁਪਏ ਪ੍ਰਤੀ ਕੁਇੰਟਲ।";
        } else if ("mr".equals(lang)) {
            speech = "भारत सरकारचे सध्याचे किमान हमीभाव पुढीलप्रमाणे आहेत: " +
                    "गहू 2275 रुपये प्रति क्विंटल. " +
                    "भात 2183 रुपये प्रति क्विंटल. " +
                    "मोहरी 5650 रुपये प्रति क्विंटल. " +
                    "हरभरा 5440 रुपये प्रति क्विंटल. " +
                    "सोयाबीन 4600 रुपये प्रति क्विंटल.";
        } else if ("en".equals(lang)) {
            speech = "Current Government Statutory MSP Rates: " +
                    "Wheat is Rs 2,275 per quintal. " +
                    "Paddy is Rs 2,183 per quintal. " +
                    "Mustard is Rs 5,650 per quintal. " +
                    "Chana Gram is Rs 5,440 per quintal. " +
                    "Soybean is Rs 4,600 per quintal.";
        } else {
            speech = "भारत सरकार द्वारा निर्धारित आज के न्यूनतम समर्थन मूल्य हैं: " +
                    "गेहूं 2275 रुपये प्रति क्विंटल। " +
                    "धान 2183 रुपये प्रति क्विंटल। " +
                    "सरसों 5650 रुपये प्रति क्विंटल। " +
                    "चना 5440 रुपये प्रति क्विंटल। " +
                    "सोयाबीन 4600 रुपये प्रति क्विंटल। भुगतान सीधे डीबीटी बैंक खाते में होगा।";
        }
        res.put("audio_speech", speech);
        return res;
    }

    private String getAgentConnectPrompt(String lang) {
        switch (lang) {
            case "pa": return "ਤੁਹਾਡੀ ਕਾਲ ਮੰਡੀ ਨੋਡਲ ਅਧਿਕਾਰੀ ਨਾਲ ਜੋੜੀ ਜਾ ਰਹੀ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਲਾਈਨ ਤੇ ਬਣੇ ਰਹੋ।";
            case "mr": return "आपला कॉल मंडी नोडल अधिकाऱ्याशी जोडला जात आहे. कृपया प्रतीक्षा करा.";
            case "en": return "Connecting your call to the Mandi Nodal Officer. Please hold the line.";
            default: return "आपकी कॉल मंडी नोडल अधिकारी से जोड़ी जा रही है। कृपया प्रतीक्षा करें।";
        }
    }

    /**
     * Returns recorded automated voice alerts / broadcasts received by a farmer
     */
    public List<Map<String, Object>> getRecordedVoiceAlerts(UUID farmerId, String mobile) {
        List<Map<String, Object>> alerts = new ArrayList<>();
        OffsetDateTime now = OffsetDateTime.now();

        // 1. Live Token Counter Alert
        alerts.add(Map.of(
                "id", 1,
                "type", "COUNTER_CALL",
                "title", "टोकन काउंटर बुलावा (Token Counter Call)",
                "timestamp", now.minusMinutes(12).toString(),
                "duration", "0:24",
                "lang", "hi-IN",
                "transcript", "नमस्ते किसान भाई, आपका टोकन नंबर सी-टी-ए 1001 अब काउंटर नंबर 2 पर बुलाया गया है। कृपया अपनी तौल पर्ची लेकर तुरंत काउंटर पर पहुंचें।",
                "status", "DELIVERED"
        ));

        // 2. Produce Acceptance Alert
        alerts.add(Map.of(
                "id", 2,
                "type", "PRODUCE_ACCEPTED",
                "title", "फसल तुलाई व गुणवत्ता पास (Produce Quality Approved)",
                "timestamp", now.minusHours(2).toString(),
                "duration", "0:31",
                "lang", "hi-IN",
                "transcript", "बधाई हो! आपकी 40 क्विंटल गेहूं की फसल की गुणवत्ता मानकों पर खरी उतरी है और नमी 12 प्रतिशत दर्ज हुई है। तुलाई सफलतापूर्वक पूरी हो गई है।",
                "status", "DELIVERED"
        ));

        // 3. DBT Payment Alert
        alerts.add(Map.of(
                "id", 3,
                "type", "PAYMENT_DISBURSED",
                "title", "डीबीटी भुगतान प्रेषित (DBT Payment Transferred)",
                "timestamp", now.minusHours(5).toString(),
                "duration", "0:36",
                "lang", "hi-IN",
                "transcript", "प्रिय किसान, आपकी फसल का कुल भुगतान 91,000 रुपये पीएफएमएस द्वारा आपके आधार लिंक बैंक खाते में भेज दिया गया है। यूटीआर संदर्भ संख्या एसएमएस पर देखें।",
                "status", "DELIVERED"
        ));

        // 4. Weather Advisory Alert
        alerts.add(Map.of(
                "id", 4,
                "type", "WEATHER_ADVISORY",
                "title", "मंडी मौसम चेतावनी (Mandi Weather Alert)",
                "timestamp", now.minusDays(1).toString(),
                "duration", "0:28",
                "lang", "hi-IN",
                "transcript", "सावधान! आज दोपहर खन्ना और नागपुर मंडी क्षेत्र में आंधी और बारिश की संभावना है। कृपया अपनी उपज को तिरपाल से ढक कर सुरक्षित शेड में रखें।",
                "status", "DELIVERED"
        ));

        return alerts;
    }
}
