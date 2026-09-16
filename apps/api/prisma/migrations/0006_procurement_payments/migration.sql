-- Additive migration 0006_procurement_payments
-- Adds weighing, quality check, and staff metadata to tokens table
-- Preserves all legacy data and prior Flyway/Prisma migrations

ALTER TABLE tokens ADD COLUMN IF NOT EXISTS gross_weight DECIMAL(10, 3);
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS tare_weight DECIMAL(10, 3);
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS net_weight DECIMAL(10, 3);
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS moisture_percent DECIMAL(5, 2);
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS quality_pass BOOLEAN;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS staff_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_tokens_status_center ON tokens(center_id, status);
