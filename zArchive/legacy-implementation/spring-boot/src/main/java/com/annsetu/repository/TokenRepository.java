package com.annsetu.repository;

import com.annsetu.entity.Token;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TokenRepository extends JpaRepository<Token, Long> {

    Optional<Token> findByTokenNumber(String tokenNumber);

    List<Token> findByFarmerIdOrderByCreatedAtDesc(UUID farmerId);

    @Query("SELECT COUNT(t) FROM Token t WHERE t.centerId = :centerId AND CAST(t.createdAt AS date) = :today")
    long countTodayTokensByCenter(@Param("centerId") UUID centerId, @Param("today") LocalDate today);

    @Query("""
        SELECT COUNT(t) FROM Token t
        JOIN Slot s ON t.slotId = s.id
        WHERE t.centerId = :centerId
        AND s.slotDate = :slotDate
        AND t.status NOT IN ('procured', 'payment_processing', 'payment_completed', 'rejected')
    """)
    long countLiveWaiting(@Param("centerId") UUID centerId, @Param("slotDate") LocalDate slotDate);

    @Query("""
        SELECT COUNT(t) FROM Token t
        JOIN Slot s ON t.slotId = s.id
        WHERE t.centerId = :centerId
        AND s.slotDate = :slotDate
        AND (
            s.startTime < :startTime
            OR (s.startTime = :startTime AND t.createdAt < :createdAt)
        )
        AND t.status NOT IN ('procured', 'payment_processing', 'payment_completed', 'rejected')
    """)
    long countFarmersAhead(
        @Param("centerId") UUID centerId,
        @Param("slotDate") LocalDate slotDate,
        @Param("startTime") String startTime,
        @Param("createdAt") OffsetDateTime createdAt
    );

    @Query("""
        SELECT t FROM Token t
        JOIN Slot s ON t.slotId = s.id
        WHERE t.centerId = :centerId
        AND s.slotDate = :slotDate
        ORDER BY s.startTime ASC, t.createdAt ASC
    """)
    List<Token> findQueueByCenterAndDate(@Param("centerId") UUID centerId, @Param("slotDate") LocalDate slotDate);

    @Query("""
        SELECT t FROM Token t
        JOIN Slot s ON t.slotId = s.id
        WHERE t.centerId = :centerId
        AND s.slotDate = :slotDate
        AND t.status IN ('booked', 'arrived')
        ORDER BY s.startTime ASC, t.createdAt ASC
        LIMIT 1
    """)
    Optional<Token> findNextInQueue(@Param("centerId") UUID centerId, @Param("slotDate") LocalDate slotDate);

    @Query("""
        SELECT t FROM Token t
        JOIN Slot s ON t.slotId = s.id
        WHERE t.centerId = :centerId
        AND s.slotDate = :slotDate
        AND t.status IN ('procured', 'payment_processing', 'payment_completed')
        ORDER BY t.updatedAt DESC
        LIMIT 20
    """)
    List<Token> findLast20CompletedTokens(@Param("centerId") UUID centerId, @Param("slotDate") LocalDate slotDate);

    @Query("""
        SELECT t.tokenNumber FROM Token t
        JOIN Slot s ON t.slotId = s.id
        WHERE t.centerId = :centerId
        AND s.slotDate = :slotDate
        AND t.status IN ('arrived', 'verification', 'quality_check', 'procured')
        ORDER BY t.updatedAt DESC
        LIMIT 1
    """)
    Optional<String> findCurrentServingToken(@Param("centerId") UUID centerId, @Param("slotDate") LocalDate slotDate);

    @Query("""
        SELECT COUNT(t) FROM Token t
        JOIN Slot s ON t.slotId = s.id
        WHERE s.slotDate = :slotDate
    """)
    long countAllByDate(@Param("slotDate") LocalDate slotDate);

    @Query("""
        SELECT COUNT(t) FROM Token t
        JOIN Slot s ON t.slotId = s.id
        WHERE s.slotDate = :slotDate
        AND t.status IN :statuses
    """)
    long countByDateAndStatusIn(@Param("slotDate") LocalDate slotDate, @Param("statuses") Collection<String> statuses);

    @Query("""
        SELECT COUNT(t) FROM Token t
        JOIN Slot s ON t.slotId = s.id
        WHERE t.centerId = :centerId
        AND s.slotDate = :slotDate
    """)
    long countCenterTokensByDate(@Param("centerId") UUID centerId, @Param("slotDate") LocalDate slotDate);

    @Query("""
        SELECT COUNT(t) FROM Token t
        JOIN Slot s ON t.slotId = s.id
        WHERE t.centerId = :centerId
        AND s.slotDate = :slotDate
        AND t.status IN ('procured', 'payment_processing', 'payment_completed')
    """)
    long countCenterCompletedByDate(@Param("centerId") UUID centerId, @Param("slotDate") LocalDate slotDate);

    List<Token> findAllByOrderByCreatedAtDesc();
}
