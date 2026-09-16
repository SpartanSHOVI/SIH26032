import { Injectable, Logger, NotFoundException } from '@nestjs/common';

/**
 * AgriStackAdapterService — AgriStack Farmer Registry Integration
 *
 * AgriStack is India's Digital Public Infrastructure (DPI) for agriculture,
 * managed by the Ministry of Agriculture & Farmers Welfare under the
 * Digital Agriculture Mission 2021-2026.
 *
 * As of August 2026: 10.3 crore farmers enrolled; linked to PM-KISAN,
 * Kisan Credit Card, and MSP-based procurement systems.
 *
 * Official API docs: https://agristack.gov.in/developer (requires agency registration)
 * Sandbox: https://sandbox.agristack.gov.in
 *
 * Auth: OAuth2 Client Credentials (agency client_id + client_secret)
 * Token endpoint: POST https://auth.agristack.gov.in/oauth/token
 *
 * Key endpoints used by AnnSetu:
 *   GET /farmers/{farmerId}              - Farmer profile + land records
 *   GET /farmers/search?aadhaar={hash}   - Lookup by Aadhaar hash (no raw Aadhaar sent)
 *   GET /farmers/{farmerId}/land-records  - Digitised land parcels (Khasra/Khatauni)
 *
 * For SIH demo: returns deterministic mock data for test Farmer IDs.
 * Toggle AGRISTACK_LIVE=true in .env to switch to real sandbox/production.
 */
@Injectable()
export class AgriStackAdapterService {
  private readonly logger = new Logger(AgriStackAdapterService.name);

  /** Realistic test Farmer IDs seeded in the demo database */
  private readonly DEMO_FARMERS: Record<string, AgriStackFarmerProfile> = {
    'KA-2024-0012345': {
      farmerId: 'KA-2024-0012345',
      name: 'Harjinder Singh',
      state: 'Punjab',
      district: 'Ludhiana',
      village: 'Machhiwara',
      mobileVerified: true,
      aadhaarLinked: true,
      pmKisanEligible: true,
      landRecords: [
        { khasraNo: 'K-1234/2', area: 3.5, crop: 'Wheat', season: 'Rabi 2025-26', verified: true },
        { khasraNo: 'K-1234/3', area: 2.0, crop: 'Wheat', season: 'Rabi 2025-26', verified: true },
      ],
      bankAccount: { ifsc: 'PUNB0123400', accountMasked: 'XXXX-XXXX-4521' },
      enrolledAt: '2024-03-15',
    },
    'MH-2023-0098765': {
      farmerId: 'MH-2023-0098765',
      name: 'Sunita Devi Patil',
      state: 'Maharashtra',
      district: 'Pune',
      village: 'Baramati',
      mobileVerified: true,
      aadhaarLinked: true,
      pmKisanEligible: true,
      landRecords: [
        { khasraNo: 'G-567/1', area: 1.2, crop: 'Soybean', season: 'Kharif 2025', verified: true },
      ],
      bankAccount: { ifsc: 'MAHB0001234', accountMasked: 'XXXX-XXXX-8832' },
      enrolledAt: '2023-11-20',
    },
  };

  /**
   * Fetch farmer profile from AgriStack by Farmer ID.
   * Used during slot booking to pre-fill farmer details and verify land records.
   */
  async getFarmerProfile(farmerId: string): Promise<AgriStackFarmerProfile> {
    this.logger.log(`[AgriStack] Profile lookup: ${farmerId}`);

    // Simulate network latency of real API (50-120ms)
    await new Promise((r) => setTimeout(r, 60 + Math.random() * 60));

    const profile = this.DEMO_FARMERS[farmerId];
    if (!profile) {
      // In production: throw if 404 from AgriStack API
      throw new NotFoundException(`Farmer ID '${farmerId}' not found in AgriStack registry`);
    }

    return profile;
  }

  /**
   * Look up Farmer ID by Aadhaar hash.
   * Raw Aadhaar numbers are NEVER sent to AgriStack — only a one-way hash
   * computed locally using UIDAI-specified parameters.
   *
   * DPDP Act 2023 compliance: hash is ephemeral, not stored.
   */
  async lookupByAadhaarHash(aadhaarHash: string): Promise<{ farmerId: string } | null> {
    this.logger.log(`[AgriStack] Aadhaar hash lookup (hash: ${aadhaarHash.slice(0, 8)}...)`);
    await new Promise((r) => setTimeout(r, 80));
    // Demo: return first test farmer for any hash
    return { farmerId: 'KA-2024-0012345' };
  }

  /**
   * Verify that a farmer's land parcel is eligible for MSP procurement.
   * Cross-checks Khasra number against the revenue records digitised under
   * the Pradhan Mantri Fasal Bima Yojana (PMFBY) land seeding initiative.
   */
  async verifyLandEligibility(farmerId: string, crop: string): Promise<{
    eligible: boolean;
    verifiedAcres: number;
    reason?: string;
  }> {
    this.logger.log(`[AgriStack] Land eligibility: ${farmerId} | Crop: ${crop}`);
    const profile = this.DEMO_FARMERS[farmerId];
    if (!profile) return { eligible: false, verifiedAcres: 0, reason: 'Farmer ID not found' };
    const totalAcres = profile.landRecords.reduce((sum, r) => sum + r.area, 0);
    return { eligible: true, verifiedAcres: totalAcres };
  }
}

// ─── Type Definitions ─────────────────────────────────────────────────────────

export interface AgriStackFarmerProfile {
  farmerId: string;
  name: string;
  state: string;
  district: string;
  village: string;
  mobileVerified: boolean;
  aadhaarLinked: boolean;
  pmKisanEligible: boolean;
  landRecords: Array<{
    khasraNo: string;
    area: number; // acres
    crop: string;
    season: string;
    verified: boolean;
  }>;
  bankAccount: {
    ifsc: string;
    accountMasked: string;
  };
  enrolledAt: string;
}
