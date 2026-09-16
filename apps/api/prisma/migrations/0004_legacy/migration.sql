-- ==============================================================================
-- AnnSetu Migration V4: Seed Diverse Unique Farmers Across Multiple States
-- ==============================================================================

-- 1. Balwinder Singh (Punjab, Ludhiana - Paddy)
INSERT INTO farmers (
    id, farmer_id, name, mobile, password_hash, aadhaar_hash, aadhaar_masked, phone_masked,
    state, district, address, crop, quantity, bank_account, ifsc,
    state_code, preferred_language, preferred_center_id, consent_given, created_at, updated_at
) VALUES (
    'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
    'FARMER-9811223344',
    'Balwinder Singh',
    '9811223344',
    '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    'XXXX-XXXX-3344',
    'XXXXXX3344',
    'Punjab',
    'Ludhiana',
    'Village Gill, Ludhiana District, Punjab',
    'Paddy',
    65.0,
    '30129847192',
    'SBIN0001234',
    'PB',
    'pa',
    'c8f2620a-258d-47e8-bdd7-0eef8ca41d18',
    true,
    NOW(),
    NOW()
) ON CONFLICT (farmer_id) DO UPDATE SET
    name = EXCLUDED.name,
    mobile = EXCLUDED.mobile,
    password_hash = EXCLUDED.password_hash,
    state = EXCLUDED.state,
    district = EXCLUDED.district,
    crop = EXCLUDED.crop,
    quantity = EXCLUDED.quantity;

-- 2. Anita Devi (Uttar Pradesh, Varanasi - Mustard)
INSERT INTO farmers (
    id, farmer_id, name, mobile, password_hash, aadhaar_hash, aadhaar_masked, phone_masked,
    state, district, address, crop, quantity, bank_account, ifsc,
    state_code, preferred_language, preferred_center_id, consent_given, created_at, updated_at
) VALUES (
    'b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e',
    'FARMER-9822334455',
    'Anita Devi',
    '9822334455',
    '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    '8f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    'XXXX-XXXX-4455',
    'XXXXXX4455',
    'Uttar Pradesh',
    'Varanasi',
    'Pindra Tehsil, Varanasi, Uttar Pradesh',
    'Mustard',
    28.0,
    '45019283741',
    'PUNB0012345',
    'UP',
    'hi',
    '41277877-e94e-4cd1-b789-3cb6e6f19be9',
    true,
    NOW(),
    NOW()
) ON CONFLICT (farmer_id) DO UPDATE SET
    name = EXCLUDED.name,
    mobile = EXCLUDED.mobile,
    password_hash = EXCLUDED.password_hash,
    state = EXCLUDED.state,
    district = EXCLUDED.district,
    crop = EXCLUDED.crop,
    quantity = EXCLUDED.quantity;

-- 3. Rajesh Kumar Sharma (Rajasthan, Jaipur - Bajra)
INSERT INTO farmers (
    id, farmer_id, name, mobile, password_hash, aadhaar_hash, aadhaar_masked, phone_masked,
    state, district, address, crop, quantity, bank_account, ifsc,
    state_code, preferred_language, preferred_center_id, consent_given, created_at, updated_at
) VALUES (
    'c3d4e5f6-a1b2-4c3d-ae4f-5a6b7c8d9e0f',
    'FARMER-9833445566',
    'Rajesh Kumar Sharma',
    '9833445566',
    '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    '7f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    'XXXX-XXXX-5566',
    'XXXXXX5566',
    'Rajasthan',
    'Jaipur',
    'Chomu Road, Jaipur District, Rajasthan',
    'Bajra',
    45.0,
    '19827364501',
    'BARB0JAIPUR',
    'RJ',
    'hi',
    '4c9e9456-ff03-417c-9c22-2b740a7ce127',
    true,
    NOW(),
    NOW()
) ON CONFLICT (farmer_id) DO UPDATE SET
    name = EXCLUDED.name,
    mobile = EXCLUDED.mobile,
    password_hash = EXCLUDED.password_hash,
    state = EXCLUDED.state,
    district = EXCLUDED.district,
    crop = EXCLUDED.crop,
    quantity = EXCLUDED.quantity;

-- 4. Suresh Gowda (Karnataka, Bagalkot - Ragi)
INSERT INTO farmers (
    id, farmer_id, name, mobile, password_hash, aadhaar_hash, aadhaar_masked, phone_masked,
    state, district, address, crop, quantity, bank_account, ifsc,
    state_code, preferred_language, preferred_center_id, consent_given, created_at, updated_at
) VALUES (
    'd4e5f6a1-b2c3-4d4e-bf5a-6b7c8d9e0f1a',
    'FARMER-9844556677',
    'Suresh Gowda',
    '9844556677',
    '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    '6f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    'XXXX-XXXX-6677',
    'XXXXXX6677',
    'Karnataka',
    'Bagalkot',
    'Badami Road, Bagalkot, Karnataka',
    'Ragi',
    35.0,
    '56210984732',
    'CNRB0002345',
    'KA',
    'en',
    'ecb1fbd8-f467-46c4-b60c-e9d9e465cdb4',
    true,
    NOW(),
    NOW()
) ON CONFLICT (farmer_id) DO UPDATE SET
    name = EXCLUDED.name,
    mobile = EXCLUDED.mobile,
    password_hash = EXCLUDED.password_hash,
    state = EXCLUDED.state,
    district = EXCLUDED.district,
    crop = EXCLUDED.crop,
    quantity = EXCLUDED.quantity;

-- Create slots for Jaipur and Bagalkot if not existing for CURRENT_DATE
INSERT INTO slots (center_id, slot_date, start_time, end_time, total_slots, booked_count)
VALUES
    ('4c9e9456-ff03-417c-9c22-2b740a7ce127', CURRENT_DATE, '09:00', '10:00', 25, 1),
    ('4c9e9456-ff03-417c-9c22-2b740a7ce127', CURRENT_DATE, '10:00', '11:00', 25, 0),
    ('ecb1fbd8-f467-46c4-b60c-e9d9e465cdb4', CURRENT_DATE, '09:00', '10:00', 25, 1),
    ('ecb1fbd8-f467-46c4-b60c-e9d9e465cdb4', CURRENT_DATE, '10:00', '11:00', 25, 0)
ON CONFLICT (center_id, slot_date, start_time) DO NOTHING;

-- Seed unique tokens for Balwinder Singh and Anita Devi
INSERT INTO tokens (token_number, farmer_id, center_id, slot_id, status, booked_via, running_late_used, payment_method, payment_status, created_at, updated_at)
VALUES
    ('LDH1001', 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d', 'c8f2620a-258d-47e8-bdd7-0eef8ca41d18', 9, 'booked', 'app', false, 'dbt', 'pending', NOW(), NOW()),
    ('VAR2001', 'b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e', '41277877-e94e-4cd1-b789-3cb6e6f19be9', 25, 'quality_check', 'app', false, 'dbt', 'processing', NOW() - INTERVAL '45 minutes', NOW())
ON CONFLICT (token_number) DO NOTHING;
