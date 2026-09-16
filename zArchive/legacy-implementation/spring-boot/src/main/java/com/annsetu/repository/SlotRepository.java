package com.annsetu.repository;

import com.annsetu.entity.Slot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SlotRepository extends JpaRepository<Slot, Long> {

    List<Slot> findByCenterIdAndSlotDateOrderByStartTimeAsc(UUID centerId, LocalDate slotDate);

    Optional<Slot> findByCenterIdAndSlotDateAndStartTime(UUID centerId, LocalDate slotDate, String startTime);

    long countByCenterIdAndSlotDate(UUID centerId, LocalDate slotDate);

    void deleteByCenterIdAndSlotDateAndBookedCount(UUID centerId, LocalDate slotDate, Integer bookedCount);
}
