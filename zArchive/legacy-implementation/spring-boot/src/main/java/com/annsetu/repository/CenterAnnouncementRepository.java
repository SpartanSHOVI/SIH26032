package com.annsetu.repository;

import com.annsetu.entity.CenterAnnouncement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CenterAnnouncementRepository extends JpaRepository<CenterAnnouncement, Long> {

    List<CenterAnnouncement> findTop20ByCenterIdOrderByCreatedAtDesc(UUID centerId);
}
