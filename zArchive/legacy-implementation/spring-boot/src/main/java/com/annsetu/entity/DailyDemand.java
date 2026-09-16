package com.annsetu.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "daily_demand", uniqueConstraints = {
    @UniqueConstraint(name = "uq_daily_demand_center_date", columnNames = {"center_id", "demand_date"})
})
public class DailyDemand {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "center_id", nullable = false)
    private UUID centerId;

    @Column(name = "demand_date", nullable = false)
    private LocalDate demandDate;

    @Column(name = "farmer_count", nullable = false)
    private Integer farmerCount;

    public DailyDemand() {}

    public DailyDemand(UUID centerId, LocalDate demandDate, Integer farmerCount) {
        this.centerId = centerId;
        this.demandDate = demandDate;
        this.farmerCount = farmerCount;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public UUID getCenterId() { return centerId; }
    public void setCenterId(UUID centerId) { this.centerId = centerId; }

    public LocalDate getDemandDate() { return demandDate; }
    public void setDemandDate(LocalDate demandDate) { this.demandDate = demandDate; }

    public Integer getFarmerCount() { return farmerCount; }
    public void setFarmerCount(Integer farmerCount) { this.farmerCount = farmerCount; }
}
