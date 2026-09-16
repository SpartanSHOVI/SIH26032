-- Additive; never replaces legacy data or Flyway history.
CREATE TABLE app_accounts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 login VARCHAR(120) UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 role VARCHAR(30) NOT NULL CHECK(role IN ('FARMER','CENTER_OPERATOR','ADMIN')),
 farmer_id UUID REFERENCES farmers(id), center_id UUID REFERENCES centers(id),
 demo BOOLEAN NOT NULL DEFAULT FALSE,
 CHECK ((role='FARMER' AND farmer_id IS NOT NULL) OR (role='CENTER_OPERATOR' AND center_id IS NOT NULL) OR role='ADMIN')
);
CREATE UNIQUE INDEX app_account_farmer ON app_accounts(farmer_id) WHERE farmer_id IS NOT NULL;
CREATE TABLE auth_sessions (
 id UUID PRIMARY KEY, account_id UUID NOT NULL REFERENCES app_accounts(id),
 refresh_hash TEXT NOT NULL, csrf_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
 revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE booking_requests (
 account_id UUID NOT NULL REFERENCES app_accounts(id), key VARCHAR(128) NOT NULL,
 payload_hash TEXT NOT NULL, response JSONB, PRIMARY KEY(account_id,key)
);
CREATE TABLE domain_audit (
 id BIGSERIAL PRIMARY KEY, actor_id UUID REFERENCES app_accounts(id),
 action TEXT NOT NULL, entity_id TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE event_outbox (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), event_type TEXT NOT NULL, aggregate_id TEXT NOT NULL, payload JSONB NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, published_at TIMESTAMPTZ,
 available_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX outbox_pending ON event_outbox(available_at) WHERE published_at IS NULL;
ALTER TABLE tokens ADD COLUMN claimed_at TIMESTAMPTZ;
ALTER TABLE tokens ADD COLUMN claimed_by UUID REFERENCES app_accounts(id);
ALTER TABLE tokens ADD COLUMN grace_until TIMESTAMPTZ;
ALTER TABLE tokens ADD COLUMN procured_at TIMESTAMPTZ;
CREATE SEQUENCE token_number_seq START 100000;
-- NOT VALID avoids rejecting historical anomalies; applies to all new/updated rows.
ALTER TABLE slots ADD CONSTRAINT nest_slot_capacity CHECK(total_slots>=0 AND booked_count>=0 AND booked_count<=total_slots) NOT VALID;
CREATE INDEX tokens_slot_order ON tokens(slot_id,created_at,id);
