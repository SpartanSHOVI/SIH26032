-- V1__init_schema.sql
-- AnnSetu Baseline Schema with RLS Policies
-- Compatible with PostgreSQL 16+

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- CENTERS TABLE
-- ============================================
CREATE TABLE centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    state_code VARCHAR(10) NOT NULL,
    daily_capacity INTEGER NOT NULL DEFAULT 100,
    address JSONB,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_centers_state_code ON centers(state_code);
CREATE INDEX idx_centers_active ON centers(active);

-- ============================================
-- FARMERS TABLE
-- ============================================
CREATE TABLE farmers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id VARCHAR(100) NOT NULL UNIQUE, -- AgriStack Farmer ID
    aadhaar_hash VARCHAR(64) NOT NULL, -- SHA-256 of last 4 digits only
    aadhaar_masked VARCHAR(20) NOT NULL, -- Format: XXXX-XXXX-1234
    name VARCHAR(255) NOT NULL,
    phone_masked VARCHAR(20) NOT NULL, -- Format: XXXXXXXX12
    state_code VARCHAR(10) NOT NULL,
    preferred_language VARCHAR(10) NOT NULL DEFAULT 'hi',
    center_preference_id UUID REFERENCES centers(id),
    consent_given BOOLEAN NOT NULL DEFAULT false,
    consent_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security for farmers
ALTER TABLE farmers ENABLE ROW LEVEL SECURITY;

-- Policy: Farmers can only see their own record
CREATE POLICY farmers_self_select ON farmers
    FOR SELECT
    USING (id = current_setting('app.current_farmer_id', true)::uuid);

-- Policy: Farmers can update their own profile
CREATE POLICY farmers_self_update ON farmers
    FOR UPDATE
    USING (id = current_setting('app.current_farmer_id', true)::uuid)
    WITH CHECK (id = current_setting('app.current_farmer_id', true)::uuid);

-- Policy: Service role (staff/officer) can see all
CREATE POLICY farmers_service_all ON farmers
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('STAFF', 'OFFICER', 'ADMIN'))
    WITH CHECK (current_setting('app.current_role', true) IN ('STAFF', 'OFFICER', 'ADMIN'));

CREATE INDEX idx_farmers_farmer_id ON farmers(farmer_id);
CREATE INDEX idx_farmers_aadhaar_hash ON farmers(aadhaar_hash);
CREATE INDEX idx_farmers_phone_masked ON farmers(phone_masked);
CREATE INDEX idx_farmers_state_code ON farmers(state_code);
CREATE INDEX idx_farmers_name_trgm ON farmers USING gin(name gin_trgm_ops);

-- ============================================
-- BOOKINGS TABLE
-- ============================================
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID NOT NULL REFERENCES farmers(id),
    center_id UUID NOT NULL REFERENCES centers(id),
    booking_date DATE NOT NULL,
    time_window_start TIME NOT NULL,
    time_window_end TIME NOT NULL,
    token_number INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_booking_status CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'EXPIRED')),
    CONSTRAINT chk_time_window CHECK (time_window_end > time_window_start),
    CONSTRAINT uq_farmer_date UNIQUE (farmer_id, booking_date)
);

CREATE INDEX idx_bookings_farmer_id ON bookings(farmer_id);
CREATE INDEX idx_bookings_center_date ON bookings(center_id, booking_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_idempotency_key ON bookings(idempotency_key);

-- ============================================
-- QUEUE_ENTRIES TABLE
-- ============================================
CREATE TABLE queue_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id),
    center_id UUID NOT NULL REFERENCES centers(id),
    queue_position INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    called_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    CONSTRAINT chk_queue_status CHECK (status IN ('WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'NO_SHOW'))
);

CREATE INDEX idx_queue_entries_center_status ON queue_entries(center_id, status);
CREATE INDEX idx_queue_entries_position ON queue_entries(center_id, queue_position) WHERE status IN ('WAITING', 'CALLED');
CREATE INDEX idx_queue_entries_booking ON queue_entries(booking_id);

-- ============================================
-- PROCUREMENT_LOTS TABLE
-- ============================================
CREATE TABLE procurement_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_entry_id UUID NOT NULL UNIQUE REFERENCES queue_entries(id),
    farmer_id UUID NOT NULL REFERENCES farmers(id),
    center_id UUID NOT NULL REFERENCES centers(id),
    gross_weight DECIMAL(10, 3),
    tare_weight DECIMAL(10, 3),
    net_weight DECIMAL(10, 3),
    moisture_percent DECIMAL(5, 2),
    quality_pass BOOLEAN,
    lot_status VARCHAR(20) NOT NULL DEFAULT 'GATE_ENTRY',
    staff_id VARCHAR(100),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_lot_status CHECK (lot_status IN ('GATE_ENTRY', 'WEIGHING', 'QC', 'ACCEPTED', 'REJECTED'))
);

CREATE INDEX idx_procurement_lots_farmer ON procurement_lots(farmer_id);
CREATE INDEX idx_procurement_lots_center_status ON procurement_lots(center_id, lot_status);
CREATE INDEX idx_procurement_lots_queue_entry ON procurement_lots(queue_entry_id);

-- ============================================
-- PAYMENTS TABLE
-- ============================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procurement_lot_id UUID NOT NULL UNIQUE REFERENCES procurement_lots(id),
    farmer_id UUID NOT NULL REFERENCES farmers(id),
    amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    utr_reference VARCHAR(100),
    credited_at TIMESTAMPTZ,
    pfms_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_payment_status CHECK (status IN ('PENDING', 'PROCESSING', 'CREDITED', 'FAILED', 'REVERSED'))
);

CREATE INDEX idx_payments_farmer ON payments(farmer_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_utr ON payments(utr_reference);

-- ============================================
-- AUDIT_EVENTS TABLE
-- ============================================
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor_type VARCHAR(20) NOT NULL, -- FARMER, STAFF, OFFICER, SYSTEM
    actor_id VARCHAR(100) NOT NULL,
    before_state JSONB,
    after_state JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_correlation ON audit_events(correlation_id);
CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_events(actor_type, actor_id);
CREATE INDEX idx_audit_created ON audit_events(created_at DESC);

-- ============================================
-- DAILY_CAPACITY TABLE (for capacity tracking)
-- ============================================
CREATE TABLE daily_capacity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES centers(id),
    capacity_date DATE NOT NULL,
    max_capacity INTEGER NOT NULL,
    booked_count INTEGER NOT NULL DEFAULT 0,
    throughput_avg_7day DECIMAL(10, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_center_date UNIQUE (center_id, capacity_date)
);

CREATE INDEX idx_daily_capacity_date ON daily_capacity(capacity_date);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID NOT NULL REFERENCES farmers(id),
    type VARCHAR(30) NOT NULL, -- BOOKING_CONFIRMED, QUEUE_APPROACHING, PROCUREMENT_COMPLETE, PAYMENT_INITIATED
    channel VARCHAR(20) NOT NULL, -- SMS, USSD, IVR, PUSH
    recipient VARCHAR(100) NOT NULL, -- phone number or farmer_id
    content TEXT NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'hi',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, SENT, DELIVERED, FAILED
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_notification_type CHECK (type IN ('BOOKING_CONFIRMED', 'QUEUE_APPROACHING', 'PROCUREMENT_COMPLETE', 'PAYMENT_INITIATED', 'QUEUE_UPDATED')),
    CONSTRAINT chk_notification_channel CHECK (channel IN ('SMS', 'USSD', 'IVR', 'PUSH')),
    CONSTRAINT chk_notification_status CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED'))
);

CREATE INDEX idx_notifications_farmer ON notifications(farmer_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_centers_updated_at BEFORE UPDATE ON centers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_farmers_updated_at BEFORE UPDATE ON farmers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_procurement_lots_updated_at BEFORE UPDATE ON procurement_lots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_daily_capacity_updated_at BEFORE UPDATE ON daily_capacity FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA: Sample Centers
-- ============================================
INSERT INTO centers (code, name, state_code, daily_capacity, address) VALUES
('PUN001', 'Khanna Grain Market', 'PB', 200, '{"district": "Ludhiana", "address": "GT Road, Khanna", "pincode": "141401"}'::jsonb),
('PUN002', 'Mandi Gobindgarh Procurement Center', 'PB', 150, '{"district": "Fatehgarh Sahib", "address": "Near Railway Station", "pincode": "147301"}'::jsonb),
('PUN003', 'Ludhiana Central Procurement', 'PB', 180, '{"district": "Ludhiana", "address": "Ferozepur Road", "pincode": "141001"}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- GRANT PERMISSIONS (for application user)
-- ============================================
-- Note: In production, create a dedicated app user with limited privileges
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO annsetu_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO annsetu_app;