package com.annsetu.repository;

import com.annsetu.entity.MessageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MessageLogRepository extends JpaRepository<MessageLog, Long> {

    List<MessageLog> findTop50ByFarmerIdOrderByCreatedAtDesc(UUID farmerId);

    List<MessageLog> findTop50ByCenterIdOrderByCreatedAtDesc(UUID centerId);

    List<MessageLog> findTop50ByOrderByCreatedAtDesc();
}
