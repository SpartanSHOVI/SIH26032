package com.annsetu.service;

import com.annsetu.entity.Center;
import com.annsetu.repository.CenterRepository;
import com.annsetu.repository.TokenRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

@Service
public class CenterService {

    private final CenterRepository centerRepository;
    private final TokenRepository tokenRepository;

    public CenterService(CenterRepository centerRepository, TokenRepository tokenRepository) {
        this.centerRepository = centerRepository;
        this.tokenRepository = tokenRepository;
    }

    public List<String> getStates() {
        return centerRepository.findDistinctStates();
    }

    public List<String> getDistricts(String state) {
        return centerRepository.findDistinctDistrictsByState(state);
    }

    public List<String> getClassifications() {
        return centerRepository.findDistinctClassifications();
    }

    public List<Map<String, Object>> getCentersByLocation(String state, String district) {
        return getCentersByLocation(state, district, null, null);
    }

    public List<Map<String, Object>> getCentersByLocation(String state, String district, String classification, String search) {
        List<Center> centers = centerRepository.findCentersFiltered(state, district, classification, search);
        LocalDate today = LocalDate.now();
        List<Map<String, Object>> result = new ArrayList<>();

        for (Center c : centers) {
            long waiting = tokenRepository.countLiveWaiting(c.getId(), today);
            int capPerHour = c.getCapacityPerHour() != null ? c.getCapacityPerHour() : 25;
            int capacityToday = c.getDailyCapacity() != null && c.getDailyCapacity() > 0 ? c.getDailyCapacity() : capPerHour * 7;
            String status = waiting < capacityToday * 0.8 ? "Available" : "Busy";

            Map<String, Object> map = toMap(c);
            map.put("waiting", waiting);
            map.put("status", status);
            result.add(map);
        }
        return result;
    }

    public List<Map<String, Object>> getAllCentersWithWaiting(LocalDate date) {
        return getAllCentersWithWaiting(date, null, null, null, null, 100);
    }

    public List<Map<String, Object>> getAllCentersWithWaiting(
            LocalDate date, String state, String district, String classification, String search, Integer limit) {
        LocalDate targetDate = date != null ? date : LocalDate.now();
        int max = limit != null && limit > 0 ? limit : 100;
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, max);
        
        List<Center> centers = centerRepository.findAllFiltered(state, district, classification, search, pageable);
        List<Map<String, Object>> result = new ArrayList<>();

        for (Center c : centers) {
            long waiting = tokenRepository.countLiveWaiting(c.getId(), targetDate);
            int capPerHour = c.getCapacityPerHour() != null ? c.getCapacityPerHour() : 25;
            int capacityToday = c.getDailyCapacity() != null && c.getDailyCapacity() > 0 ? c.getDailyCapacity() : capPerHour * 7;
            String status = waiting < capacityToday * 0.8 ? "Available" : "Busy";

            Map<String, Object> map = toMap(c);
            map.put("waiting", waiting);
            map.put("status", status);
            result.add(map);
        }
        return result;
    }

    public Optional<Center> getCenterById(UUID id) {
        return centerRepository.findById(id);
    }

    public Optional<Center> getCenterByCode(String code) {
        return centerRepository.findByCode(code);
    }

    private Map<String, Object> toMap(Center c) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", c.getId().toString());
        map.put("code", c.getCode());
        map.put("name", c.getName());
        map.put("state", c.getState());
        map.put("district", c.getDistrict());
        map.put("location", c.getLocation());
        map.put("distance_km", c.getDistanceKm());
        map.put("capacity_per_hour", c.getCapacityPerHour());
        map.put("counters", c.getCounters());
        map.put("avg_processing_min", c.getAvgProcessingMin());
        map.put("daily_capacity", c.getDailyCapacity());
        map.put("market_id", c.getMarketId());
        map.put("state_id", c.getStateId());
        map.put("district_id", c.getDistrictId());
        map.put("classification", c.getClassification() != null ? c.getClassification() : "APMC (Regulated)");
        return map;
    }
}
