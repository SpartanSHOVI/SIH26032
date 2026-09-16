package com.annsetu.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "farmers")
public class Farmer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "farmer_id", unique = true, length = 100)
    private String farmerId;

    @Column(nullable = false)
    private String name;

    @Column(length = 20)
    private String mobile;

    @Column(name = "password_hash", length = 128)
    private String passwordHash;

    @Column(length = 255)
    private String address;

    @Column(length = 120)
    private String state;

    @Column(length = 120)
    private String district;

    @Column(length = 100)
    private String crop;

    private Double quantity;

    @Column(name = "bank_account", length = 40)
    private String bankAccount;

    @Column(length = 20)
    private String ifsc;

    @Column(name = "preferred_center_id")
    private UUID preferredCenterId;

    @Column(length = 20)
    private String language = "English";

    @Column(name = "preferred_language", length = 10)
    private String preferredLanguage = "hi";

    @Column(name = "aadhaar_hash", length = 64)
    private String aadhaarHash;

    @Column(name = "aadhaar_masked", length = 20)
    private String aadhaarMasked;

    @Column(name = "phone_masked", length = 20)
    private String phoneMasked;

    @Column(name = "state_code", length = 10)
    private String stateCode;

    @Column(name = "consent_given", nullable = false)
    private Boolean consentGiven = true;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    public Farmer() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getFarmerId() { return farmerId; }
    public void setFarmerId(String farmerId) { this.farmerId = farmerId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getMobile() { return mobile; }
    public void setMobile(String mobile) { this.mobile = mobile; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }

    public String getCrop() { return crop; }
    public void setCrop(String crop) { this.crop = crop; }

    public Double getQuantity() { return quantity; }
    public void setQuantity(Double quantity) { this.quantity = quantity; }

    public String getBankAccount() { return bankAccount; }
    public void setBankAccount(String bankAccount) { this.bankAccount = bankAccount; }

    public String getIfsc() { return ifsc; }
    public void setIfsc(String ifsc) { this.ifsc = ifsc; }

    public UUID getPreferredCenterId() { return preferredCenterId; }
    public void setPreferredCenterId(UUID preferredCenterId) { this.preferredCenterId = preferredCenterId; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public String getPreferredLanguage() { return preferredLanguage; }
    public void setPreferredLanguage(String preferredLanguage) { this.preferredLanguage = preferredLanguage; }

    public String getAadhaarHash() { return aadhaarHash; }
    public void setAadhaarHash(String aadhaarHash) { this.aadhaarHash = aadhaarHash; }

    public String getAadhaarMasked() { return aadhaarMasked; }
    public void setAadhaarMasked(String aadhaarMasked) { this.aadhaarMasked = aadhaarMasked; }

    public String getPhoneMasked() { return phoneMasked; }
    public void setPhoneMasked(String phoneMasked) { this.phoneMasked = phoneMasked; }

    public String getStateCode() { return stateCode; }
    public void setStateCode(String stateCode) { this.stateCode = stateCode; }

    public Boolean getConsentGiven() { return consentGiven; }
    public void setConsentGiven(Boolean consentGiven) { this.consentGiven = consentGiven; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
