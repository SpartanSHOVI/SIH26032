package com.annsetu.service;

import com.annsetu.entity.MessageLog;
import com.annsetu.entity.Notification;
import com.annsetu.repository.MessageLogRepository;
import com.annsetu.repository.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final MessageLogRepository messageLogRepository;

    public NotificationService(NotificationRepository notificationRepository, MessageLogRepository messageLogRepository) {
        this.notificationRepository = notificationRepository;
        this.messageLogRepository = messageLogRepository;
    }

    @Transactional
    public void pushNotification(UUID farmerId, String message) {
        if (farmerId == null || message == null || message.isBlank()) return;
        Notification notification = new Notification(farmerId, message);
        notificationRepository.save(notification);
    }

    @Transactional
    public void logMessage(UUID farmerId, UUID centerId, String channel, String recipient, String message) {
        if (recipient == null || recipient.isBlank()) return;
        MessageLog log = new MessageLog(farmerId, centerId, channel, recipient, message);
        messageLogRepository.save(log);
    }

    @Transactional
    public void notifyFarmerMultiChannel(UUID farmerId, UUID centerId, String mobile, String inAppMsg, String smsMsg, String waMsg) {
        pushNotification(farmerId, inAppMsg);
        if (mobile != null && !mobile.isBlank()) {
            logMessage(farmerId, centerId, "SMS", mobile, smsMsg != null ? smsMsg : inAppMsg);
            logMessage(farmerId, centerId, "WhatsApp", mobile, waMsg != null ? waMsg : inAppMsg);
        }
    }

    public List<Notification> getFarmerNotifications(UUID farmerId) {
        return notificationRepository.findTop20ByFarmerIdOrderByCreatedAtDesc(farmerId);
    }

    public List<MessageLog> getMessageLogs(UUID farmerId, UUID centerId) {
        if (farmerId != null) {
            return messageLogRepository.findTop50ByFarmerIdOrderByCreatedAtDesc(farmerId);
        } else if (centerId != null) {
            return messageLogRepository.findTop50ByCenterIdOrderByCreatedAtDesc(centerId);
        }
        return messageLogRepository.findTop50ByOrderByCreatedAtDesc();
    }
}
