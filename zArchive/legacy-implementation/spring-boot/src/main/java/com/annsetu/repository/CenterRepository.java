package com.annsetu.repository;

import com.annsetu.entity.Center;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CenterRepository extends JpaRepository<Center, UUID> {

    Optional<Center> findByCode(String code);

    Optional<Center> findByMarketId(Integer marketId);

    List<Center> findByActiveTrueOrderByDistanceKmAsc();

    @Query("SELECT DISTINCT c.state FROM Center c WHERE c.state IS NOT NULL AND c.state <> '' ORDER BY c.state")
    List<String> findDistinctStates();

    @Query("SELECT DISTINCT c.district FROM Center c WHERE c.state = :state AND c.district IS NOT NULL AND c.district <> '' ORDER BY c.district")
    List<String> findDistinctDistrictsByState(@Param("state") String state);

    @Query("SELECT DISTINCT c.classification FROM Center c WHERE c.classification IS NOT NULL AND c.classification <> '' ORDER BY c.classification")
    List<String> findDistinctClassifications();

    @Query("SELECT c FROM Center c WHERE c.state = :state AND c.district = :district " +
           "AND (:classification IS NULL OR :classification = '' OR c.classification = :classification) " +
           "AND (:search IS NULL OR :search = '' OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "AND c.active = true ORDER BY c.name ASC")
    List<Center> findCentersFiltered(
            @Param("state") String state,
            @Param("district") String district,
            @Param("classification") String classification,
            @Param("search") String search);

    @Query("SELECT c FROM Center c WHERE (:state IS NULL OR :state = '' OR c.state = :state) " +
           "AND (:district IS NULL OR :district = '' OR c.district = :district) " +
           "AND (:classification IS NULL OR :classification = '' OR c.classification = :classification) " +
           "AND (:search IS NULL OR :search = '' OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(c.code) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "AND c.active = true ORDER BY c.state ASC, c.district ASC, c.name ASC")
    List<Center> findAllFiltered(
            @Param("state") String state,
            @Param("district") String district,
            @Param("classification") String classification,
            @Param("search") String search,
            Pageable pageable);

    List<Center> findByStateAndDistrictAndActiveTrueOrderByNameAsc(String state, String district);
}

