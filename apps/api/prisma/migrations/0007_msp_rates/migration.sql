-- Additive migration 0007_msp_rates
-- Provides dynamic statutory MSP floor price management for Nodal Officers and statutory CACP tracking

CREATE TABLE IF NOT EXISTS msp_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    season VARCHAR(50) NOT NULL,
    price_per_quintal NUMERIC(10, 2) NOT NULL,
    bonus_per_quintal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    market_average NUMERIC(10, 2),
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    source VARCHAR(100) NOT NULL DEFAULT 'CACP / CCEA Statutory Gazette',
    updated_by VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_msp_rates_crop ON msp_rates(crop);
CREATE INDEX IF NOT EXISTS idx_msp_rates_category ON msp_rates(category);
CREATE INDEX IF NOT EXISTS idx_msp_rates_is_active ON msp_rates(is_active);

CREATE TABLE IF NOT EXISTS msp_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    msp_rate_id UUID REFERENCES msp_rates(id) ON DELETE CASCADE,
    crop VARCHAR(100) NOT NULL,
    previous_price NUMERIC(10, 2) NOT NULL,
    new_price NUMERIC(10, 2) NOT NULL,
    previous_bonus NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    new_bonus NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    reason VARCHAR(255) NOT NULL,
    updated_by VARCHAR(100) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_msp_audit_logs_crop ON msp_audit_logs(crop);
CREATE INDEX IF NOT EXISTS idx_msp_audit_logs_changed_at ON msp_audit_logs(changed_at DESC);

-- Seed initial statutory Government of India CCEA/CACP MSP benchmarks
INSERT INTO msp_rates (crop, category, season, price_per_quintal, bonus_per_quintal, market_average, source, notes)
VALUES
    ('Wheat', 'Cereal', 'Rabi 2025-26', 2275.00, 0.00, 2150.00, 'CACP / CCEA Statutory Gazette', 'Statutory floor rate notified by Ministry of Agriculture & Farmers Welfare'),
    ('Paddy', 'Cereal', 'Kharif 2025-26', 2183.00, 0.00, 2020.00, 'CACP / CCEA Statutory Gazette', 'Common grade paddy minimum support price'),
    ('Paddy (Common)', 'Cereal', 'Kharif 2025-26', 2183.00, 0.00, 2020.00, 'CACP / CCEA Statutory Gazette', 'Common grade paddy standard procurement floor'),
    ('Paddy (Grade A)', 'Cereal', 'Kharif 2025-26', 2203.00, 0.00, 2080.00, 'CACP / CCEA Statutory Gazette', 'Grade A fine paddy procurement rate'),
    ('Mustard', 'Oilseed', 'Rabi 2025-26', 5650.00, 0.00, 5200.00, 'CACP / CCEA Statutory Gazette', 'Rapeseed and mustard seed standard MSP'),
    ('Mustard Seed', 'Oilseed', 'Rabi 2025-26', 5650.00, 0.00, 5200.00, 'CACP / CCEA Statutory Gazette', 'Rapeseed and mustard seed standard MSP'),
    ('Rapeseed', 'Oilseed', 'Rabi 2025-26', 5650.00, 0.00, 5200.00, 'CACP / CCEA Statutory Gazette', 'Notified oilseed rate'),
    ('Gram', 'Pulse', 'Rabi 2025-26', 5440.00, 0.00, 5100.00, 'CACP / CCEA Statutory Gazette', 'Chana / Bengal Gram statutory procurement floor'),
    ('Gram (Chana)', 'Pulse', 'Rabi 2025-26', 5440.00, 0.00, 5100.00, 'CACP / CCEA Statutory Gazette', 'Chana / Bengal Gram statutory procurement floor'),
    ('Chana', 'Pulse', 'Rabi 2025-26', 5440.00, 0.00, 5100.00, 'CACP / CCEA Statutory Gazette', 'Chana / Bengal Gram statutory procurement floor'),
    ('Soybean', 'Oilseed', 'Kharif 2025-26', 4600.00, 0.00, 4350.00, 'CACP / CCEA Statutory Gazette', 'Yellow Soybean MSP guarantee'),
    ('Soybean (Yellow)', 'Oilseed', 'Kharif 2025-26', 4600.00, 0.00, 4350.00, 'CACP / CCEA Statutory Gazette', 'Yellow Soybean MSP guarantee'),
    ('Maize', 'Cereal', 'Kharif 2025-26', 2090.00, 0.00, 1950.00, 'CACP / CCEA Statutory Gazette', 'Corn / Maize support price'),
    ('Cotton', 'Commercial', 'Kharif 2025-26', 6620.00, 0.00, 6400.00, 'CACP / CCEA Statutory Gazette', 'Medium staple cotton support price'),
    ('Cotton (Medium Staple)', 'Commercial', 'Kharif 2025-26', 6620.00, 0.00, 6400.00, 'CACP / CCEA Statutory Gazette', 'Medium staple cotton support price'),
    ('Cotton (Long Staple)', 'Commercial', 'Kharif 2025-26', 7020.00, 0.00, 6800.00, 'CACP / CCEA Statutory Gazette', 'Long staple premium cotton support price'),
    ('Bajra', 'Nutri-Cereal', 'Kharif 2025-26', 2500.00, 0.00, 2300.00, 'CACP / CCEA Statutory Gazette', 'Pearl millet nutri-cereal procurement floor'),
    ('Bajra (Pearl Millet)', 'Nutri-Cereal', 'Kharif 2025-26', 2500.00, 0.00, 2300.00, 'CACP / CCEA Statutory Gazette', 'Pearl millet nutri-cereal procurement floor'),
    ('Moong', 'Pulse', 'Kharif 2025-26', 8558.00, 0.00, 8100.00, 'CACP / CCEA Statutory Gazette', 'Green gram / Moong support price'),
    ('Urad', 'Pulse', 'Kharif 2025-26', 6950.00, 0.00, 6600.00, 'CACP / CCEA Statutory Gazette', 'Black gram / Urad support price'),
    ('Groundnut', 'Oilseed', 'Kharif 2025-26', 6377.00, 0.00, 5900.00, 'CACP / CCEA Statutory Gazette', 'Groundnut pod support price'),
    ('Jowar', 'Nutri-Cereal', 'Kharif 2025-26', 3180.00, 0.00, 2900.00, 'CACP / CCEA Statutory Gazette', 'Sorghum / Jowar hybrid rate'),
    ('Barley', 'Cereal', 'Rabi 2025-26', 1850.00, 0.00, 1720.00, 'CACP / CCEA Statutory Gazette', 'Rabi barley floor price'),
    ('Lentil (Masur)', 'Pulse', 'Rabi 2025-26', 6425.00, 0.00, 6100.00, 'CACP / CCEA Statutory Gazette', 'Masur pulse procurement rate')
ON CONFLICT (crop) DO UPDATE SET
    price_per_quintal = EXCLUDED.price_per_quintal,
    bonus_per_quintal = EXCLUDED.bonus_per_quintal,
    category = EXCLUDED.category,
    season = EXCLUDED.season,
    source = EXCLUDED.source,
    updated_at = CURRENT_TIMESTAMP;
