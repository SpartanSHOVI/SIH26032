-- V2__kisanconnect_workflow.sql
-- Migration to support full KisanConnect logical workflow in AnnSetu

-- 1. Enhance centers table
ALTER TABLE centers ADD COLUMN IF NOT EXISTS state VARCHAR(120);
ALTER TABLE centers ADD COLUMN IF NOT EXISTS district VARCHAR(120);
ALTER TABLE centers ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE centers ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION DEFAULT 5.0;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS capacity_per_hour INTEGER DEFAULT 25;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS counters INTEGER DEFAULT 2;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS avg_processing_min DOUBLE PRECISION DEFAULT 7.0;

UPDATE centers SET state = 'Punjab', district = 'Ludhiana', location = 'GT Road, Khanna', distance_km = 4.5 WHERE code = 'PUN001' AND state IS NULL;
UPDATE centers SET state = 'Punjab', district = 'Fatehgarh Sahib', location = 'Near Railway Station', distance_km = 8.0 WHERE code = 'PUN002' AND state IS NULL;
UPDATE centers SET state = 'Punjab', district = 'Ludhiana', location = 'Ferozepur Road', distance_km = 12.0 WHERE code = 'PUN003' AND state IS NULL;

-- Additional seed centers from KisanConnect demo
INSERT INTO centers (id, code, name, state_code, state, district, location, distance_km, capacity_per_hour, counters, avg_processing_min, daily_capacity)
VALUES
  (gen_random_uuid(), 'CTA', 'Center A - Wardha Road Mandi', 'MH', 'Maharashtra', 'Nagpur', 'Wardha Road, Nagpur', 5.0, 25, 2, 7.0, 100),
  (gen_random_uuid(), 'CTB', 'Center B - Kalmeshwar Mandi', 'MH', 'Maharashtra', 'Nagpur', 'Kalmeshwar, Nagpur', 8.0, 20, 2, 8.0, 80),
  (gen_random_uuid(), 'CTC', 'Center C - Katol Mandi', 'MH', 'Maharashtra', 'Nagpur', 'Katol, Nagpur', 14.0, 15, 1, 9.0, 60),
  (gen_random_uuid(), 'UP001', 'Varanasi Grain Mandi', 'UP', 'Uttar Pradesh', 'Varanasi', 'Raja Talab, Varanasi', 6.0, 30, 3, 6.5, 120),
  (gen_random_uuid(), 'HR001', 'Karnal Grain Market', 'HR', 'Haryana', 'Karnal', 'Sector 3, Karnal', 7.5, 25, 2, 7.0, 100)
ON CONFLICT (code) DO UPDATE SET
  state = EXCLUDED.state,
  district = EXCLUDED.district,
  location = EXCLUDED.location,
  distance_km = EXCLUDED.distance_km,
  capacity_per_hour = EXCLUDED.capacity_per_hour,
  counters = EXCLUDED.counters,
  avg_processing_min = EXCLUDED.avg_processing_min;

-- 2. Enhance farmers table
ALTER TABLE farmers DISABLE ROW LEVEL SECURITY;
ALTER TABLE farmers ALTER COLUMN aadhaar_hash DROP NOT NULL;
ALTER TABLE farmers ALTER COLUMN aadhaar_masked DROP NOT NULL;
ALTER TABLE farmers ALTER COLUMN phone_masked DROP NOT NULL;
ALTER TABLE farmers ALTER COLUMN state_code DROP NOT NULL;

ALTER TABLE farmers ADD COLUMN IF NOT EXISTS mobile VARCHAR(20);
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS password_hash VARCHAR(128);
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS address VARCHAR(255);
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS state VARCHAR(120);
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS district VARCHAR(120);
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS crop VARCHAR(100);
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS quantity DOUBLE PRECISION;
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS bank_account VARCHAR(40);
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS ifsc VARCHAR(20);
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS preferred_center_id UUID REFERENCES centers(id);
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS language VARCHAR(20) DEFAULT 'English';

CREATE INDEX IF NOT EXISTS idx_farmers_mobile ON farmers(mobile);

-- 3. Create slots table
CREATE TABLE IF NOT EXISTS slots (
    id BIGSERIAL PRIMARY KEY,
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    slot_date DATE NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    total_slots INTEGER NOT NULL DEFAULT 25,
    booked_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_slot_center_date_time UNIQUE (center_id, slot_date, start_time)
);
CREATE INDEX IF NOT EXISTS idx_slots_center_date ON slots(center_id, slot_date);

-- 4. Create tokens table
CREATE TABLE IF NOT EXISTS tokens (
    id BIGSERIAL PRIMARY KEY,
    token_number VARCHAR(30) UNIQUE NOT NULL,
    farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    slot_id BIGINT NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'booked',
    quantity_received DOUBLE PRECISION,
    reject_reason VARCHAR(255),
    booked_via VARCHAR(20) DEFAULT 'app',
    running_late_used BOOLEAN DEFAULT FALSE,
    payment_method VARCHAR(20) DEFAULT 'pending',
    payment_status VARCHAR(20) DEFAULT 'pending',
    payment_amount DECIMAL(12,2),
    transaction_ref VARCHAR(100),
    payment_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tokens_center_date ON tokens(center_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tokens_farmer ON tokens(farmer_id);
CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(status);
CREATE INDEX IF NOT EXISTS idx_tokens_number ON tokens(token_number);

-- 5. Create center_announcements table
CREATE TABLE IF NOT EXISTS center_announcements (
    id BIGSERIAL PRIMARY KEY,
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    reason VARCHAR(120) NOT NULL,
    new_date DATE,
    new_time VARCHAR(30),
    message VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_announcements_center ON center_announcements(center_id);

-- 6. Create message_logs table
CREATE TABLE IF NOT EXISTS message_logs (
    id BIGSERIAL PRIMARY KEY,
    farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
    center_id UUID REFERENCES centers(id) ON DELETE SET NULL,
    channel VARCHAR(20) NOT NULL,
    recipient VARCHAR(80) NOT NULL,
    message VARCHAR(500) NOT NULL,
    status VARCHAR(30) DEFAULT 'simulated-delivered',
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msg_logs_farmer ON message_logs(farmer_id);
CREATE INDEX IF NOT EXISTS idx_msg_logs_center ON message_logs(center_id);

-- 7. Create daily_demand table
CREATE TABLE IF NOT EXISTS daily_demand (
    id BIGSERIAL PRIMARY KEY,
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    demand_date DATE NOT NULL,
    farmer_count INTEGER NOT NULL,
    CONSTRAINT uq_daily_demand_center_date UNIQUE(center_id, demand_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_demand_center ON daily_demand(center_id, demand_date);

-- 8. Enhance notifications table
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notification_channel;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notification_type;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notification_status;
ALTER TABLE notifications ALTER COLUMN recipient DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN content DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN channel DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN type DROP NOT NULL;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message VARCHAR(500);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type VARCHAR(40) DEFAULT 'general';

-- 9. Seed slots for today for all centers
DO $$
DECLARE
    center_rec RECORD;
    t_date DATE := CURRENT_DATE;
BEGIN
    FOR center_rec IN SELECT id, capacity_per_hour FROM centers LOOP
        INSERT INTO slots (center_id, slot_date, start_time, end_time, total_slots, booked_count)
        VALUES
            (center_rec.id, t_date, '09:00', '10:00', center_rec.capacity_per_hour, 0),
            (center_rec.id, t_date, '10:00', '11:00', center_rec.capacity_per_hour, 0),
            (center_rec.id, t_date, '11:00', '12:00', center_rec.capacity_per_hour, 0),
            (center_rec.id, t_date, '12:00', '13:00', center_rec.capacity_per_hour, 0)
        ON CONFLICT (center_id, slot_date, start_time) DO NOTHING;
    END LOOP;
END $$;

-- 10. Seed 14 days of historical daily demand per center for prediction
DO $$
DECLARE
    center_rec RECORD;
    i INT;
    d DATE;
    weekday_val INT;
    counts INT[] := ARRAY[100, 130, 170, 150, 190, 90, 60];
    sample_count INT;
BEGIN
    FOR center_rec IN SELECT id FROM centers LOOP
        FOR i IN 1..14 LOOP
            d := CURRENT_DATE - i;
            weekday_val := EXTRACT(DOW FROM d)::INT; -- 0 is Sunday, 1 is Monday, etc.
            IF weekday_val = 0 THEN
                weekday_val := 7;
            END IF;
            sample_count := counts[weekday_val] + ((i * 7) % 20 - 10);
            IF sample_count < 20 THEN sample_count := 45; END IF;
            INSERT INTO daily_demand (center_id, demand_date, farmer_count)
            VALUES (center_rec.id, d, sample_count)
            ON CONFLICT (center_id, demand_date) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;
