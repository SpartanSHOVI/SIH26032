package com.annsetu.repository;

import com.annsetu.entity.Farmer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface FarmerRepository extends JpaRepository<Farmer, UUID> {

    Optional<Farmer> findByMobile(String mobile);

    Optional<Farmer> findByFarmerId(String farmerId);

    Optional<Farmer> findByAadhaarHash(String aadhaarHash);

    boolean existsByMobile(String mobile);
}
