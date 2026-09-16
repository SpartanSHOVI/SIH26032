package com.annsetu.repository;

import com.annsetu.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    List<Notification> findTop20ByFarmerIdOrderByCreatedAtDesc(UUID farmerId);
}
