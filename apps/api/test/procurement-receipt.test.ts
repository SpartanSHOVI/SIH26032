import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('APMC Farmer Procurement Slip (शेतकरी पावती / J-Form)', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3001/api/v1';

  it('1. should return structured official Shetkari Pavti format matching Maharashtra APMC specs', async () => {
    const res = await fetch(`${API_URL}/procurement/1/receipt`);
    if (res.status === 404) {
      // If token 1 does not exist in the active test DB, ensure 404 with error message
      const err = await res.json();
      assert.ok(err.message.includes('Procurement record not found'));
      return;
    }

    assert.equal(res.status, 200);
    const slip = await res.json();

    // Verify main fields match authentic example
    assert.ok(slip.organization, 'Missing organization');
    assert.ok(slip.organization.includes('कृ.उ.बा.स.'), 'Organization should contain कृ.उ.बा.स.');
    assert.equal(slip.slip_type, 'शेतकरी पावती (Farmer Receipt)');
    assert.ok(slip.status, 'Missing status');
    assert.ok(slip.date, 'Missing date');
    assert.ok(slip.time, 'Missing time');
    assert.ok(slip.receipt_no, 'Missing receipt_no');
    assert.ok(slip.trader, 'Missing trader');
    assert.ok(slip.weighing_no, 'Missing weighing_no');
    assert.ok(slip.seller_name, 'Missing seller_name');
    assert.ok(slip.seller_mobile, 'Missing seller_mobile');
    assert.ok(slip.seller_village, 'Missing seller_village');
    assert.ok(slip.department_grade, 'Missing department_grade');
    assert.ok(slip.lot_no, 'Missing lot_no');
    assert.ok(slip.grain_type, 'Missing grain_type');
    assert.ok(slip.buyer, 'Missing buyer');
    assert.ok(slip.sub_buyer, 'Missing sub_buyer');
    assert.ok(typeof slip.bags === 'number', 'bags should be a number');
    assert.ok(typeof slip.weight_kg === 'number', 'weight_kg should be a number');
    assert.ok(typeof slip.rate_per_100_kg === 'number', 'rate_per_100_kg should be a number');
    assert.ok(typeof slip.total_bags === 'number', 'total_bags should be a number');
    assert.ok(typeof slip.total_weight_kg === 'number', 'total_weight_kg should be a number');
    assert.ok(typeof slip.total_amount === 'number', 'total_amount should be a number');
    assert.ok(typeof slip.net_amount === 'number', 'net_amount should be a number');
    assert.ok(slip.powered_by.includes('AnnSetu'), 'Powered by should reference AnnSetu');
  });

  it('2. should handle non-existent tokens with 404 NotFoundException', async () => {
    const res = await fetch(`${API_URL}/procurement/999999999/receipt`);
    assert.equal(res.status, 404);
    const err = await res.json();
    assert.ok(err.message.includes('not found'));
  });
});
