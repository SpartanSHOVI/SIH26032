package com.annsetu.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "tokens")
public class Token {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "token_number", unique = true, nullable = false, length = 30)
    private String tokenNumber;

    @Column(name = "farmer_id", nullable = false)
    private UUID farmerId;

    @Column(name = "center_id", nullable = false)
    private UUID centerId;

    @Column(name = "slot_id", nullable = false)
    private Long slotId;

    @Column(nullable = false, length = 30)
    private String status = "booked";

    @Column(name = "quantity_received")
    private Double quantityReceived;

    @Column(name = "reject_reason", length = 255)
    private String rejectReason;

    @Column(name = "booked_via", length = 20)
    private String bookedVia = "app";

    @Column(name = "running_late_used")
    private Boolean runningLateUsed = false;

    @Column(name = "payment_method", length = 20)
    private String paymentMethod = "pending";

    @Column(name = "payment_status", length = 20)
    private String paymentStatus = "pending";

    @Column(name = "payment_amount")
    private BigDecimal paymentAmount;

    @Column(name = "transaction_ref", length = 100)
    private String transactionRef;

    @Column(name = "payment_at")
    private OffsetDateTime paymentAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    public Token() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTokenNumber() { return tokenNumber; }
    public void setTokenNumber(String tokenNumber) { this.tokenNumber = tokenNumber; }

    public UUID getFarmerId() { return farmerId; }
    public void setFarmerId(UUID farmerId) { this.farmerId = farmerId; }

    public UUID getCenterId() { return centerId; }
    public void setCenterId(UUID centerId) { this.centerId = centerId; }

    public Long getSlotId() { return slotId; }
    public void setSlotId(Long slotId) { this.slotId = slotId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Double getQuantityReceived() { return quantityReceived; }
    public void setQuantityReceived(Double quantityReceived) { this.quantityReceived = quantityReceived; }

    public String getRejectReason() { return rejectReason; }
    public void setRejectReason(String rejectReason) { this.rejectReason = rejectReason; }

    public String getBookedVia() { return bookedVia; }
    public void setBookedVia(String bookedVia) { this.bookedVia = bookedVia; }

    public Boolean getRunningLateUsed() { return runningLateUsed; }
    public void setRunningLateUsed(Boolean runningLateUsed) { this.runningLateUsed = runningLateUsed; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public BigDecimal getPaymentAmount() { return paymentAmount; }
    public void setPaymentAmount(BigDecimal paymentAmount) { this.paymentAmount = paymentAmount; }

    public String getTransactionRef() { return transactionRef; }
    public void setTransactionRef(String transactionRef) { this.transactionRef = transactionRef; }

    public OffsetDateTime getPaymentAt() { return paymentAt; }
    public void setPaymentAt(OffsetDateTime paymentAt) { this.paymentAt = paymentAt; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
