-- Compatibility seed used only to make the legacy V4 farmer/token seed replayable.
-- The original V4 SQL is preserved byte-for-byte in 0004_legacy.
INSERT INTO centers (id, code, name, state_code, state, district, location, daily_capacity, capacity_per_hour, counters, avg_processing_min)
VALUES
  ('c8f2620a-258d-47e8-bdd7-0eef8ca41d18', 'LDH', 'Ludhiana Grain Mandi', 'PB', 'Punjab', 'Ludhiana', 'Ludhiana District, Punjab', 120, 25, 2, 7.0),
  ('41277877-e94e-4cd1-b789-3cb6e6f19be9', 'VAR', 'Varanasi Grain Mandi Seed', 'UP', 'Uttar Pradesh', 'Varanasi', 'Pindra Tehsil, Varanasi', 120, 30, 3, 6.5),
  ('4c9e9456-ff03-417c-9c22-2b740a7ce127', 'JAI', 'Jaipur Bajra Mandi', 'RJ', 'Rajasthan', 'Jaipur', 'Chomu Road, Jaipur', 100, 25, 2, 7.0),
  ('ecb1fbd8-f467-46c4-b60c-e9d9e465cdb4', 'BAG', 'Bagalkot Ragi Mandi', 'KA', 'Karnataka', 'Bagalkot', 'Bagalkot, Karnataka', 100, 25, 2, 7.0)
ON CONFLICT (code) DO NOTHING;
