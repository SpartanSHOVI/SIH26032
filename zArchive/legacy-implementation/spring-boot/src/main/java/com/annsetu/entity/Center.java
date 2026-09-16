package com.annsetu.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "centers")
public class Center {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(name = "state_code", length = 10)
    private String stateCode;

    @Column(length = 120)
    private String state;

    @Column(length = 120)
    private String district;

    @Column(length = 255)
    private String location;

    @Column(name = "distance_km")
    private Double distanceKm = 5.0;

    @Column(name = "capacity_per_hour")
    private Integer capacityPerHour = 25;

    @Column(name = "counters")
    private Integer counters = 2;

    @Column(name = "avg_processing_min")
    private Double avgProcessingMin = 7.0;

    @Column(name = "daily_capacity")
    private Integer dailyCapacity = 100;

    @Column(name = "market_id")
    private Integer marketId;

    @Column(name = "state_id")
    private Integer stateId;

    @Column(name = "district_id")
    private Integer districtId;

    @Column(length = 50)
    private String classification = "APMC (Regulated)";

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    public Center() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getStateCode() { return stateCode; }
    public void setStateCode(String stateCode) { this.stateCode = stateCode; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public Double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(Double distanceKm) { this.distanceKm = distanceKm; }

    public Integer getCapacityPerHour() { return capacityPerHour; }
    public void setCapacityPerHour(Integer capacityPerHour) { this.capacityPerHour = capacityPerHour; }

    public Integer getCounters() { return counters; }
    public void setCounters(Integer counters) { this.counters = counters; }

    public Double getAvgProcessingMin() { return avgProcessingMin; }
    public void setAvgProcessingMin(Double avgProcessingMin) { this.avgProcessingMin = avgProcessingMin; }

    public Integer getDailyCapacity() { return dailyCapacity; }
    public void setDailyCapacity(Integer dailyCapacity) { this.dailyCapacity = dailyCapacity; }

    public Integer getMarketId() { return marketId; }
    public void setMarketId(Integer marketId) { this.marketId = marketId; }

    public Integer getStateId() { return stateId; }
    public void setStateId(Integer stateId) { this.stateId = stateId; }

    public Integer getDistrictId() { return districtId; }
    public void setDistrictId(Integer districtId) { this.districtId = districtId; }

    public String getClassification() { return classification; }
    public void setClassification(String classification) { this.classification = classification; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
