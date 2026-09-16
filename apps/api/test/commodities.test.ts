import test from 'node:test';
import assert from 'node:assert/strict';
import { LocationsController } from '../src/modules/locations/locations.controller';

test('Commodities master taxonomy and classification test', async (t) => {
  const controller = new LocationsController({} as any);

  await t.test('1. should return all 16 distinct agricultural commodity groups with counts', () => {
    const groups = controller.commodityGroups();
    assert(Array.isArray(groups), 'Expected array of groups');
    assert.equal(groups.length, 16, 'Expected 16 agricultural groups');

    const groupNames = groups.map((g) => g.name);
    assert(groupNames.includes('Cereals'), 'Expected Cereals in groups');
    assert(groupNames.includes('Pulses'), 'Expected Pulses in groups');
    assert(groupNames.includes('Oil Seeds'), 'Expected Oil Seeds in groups');
    assert(groupNames.includes('Vegetables'), 'Expected Vegetables in groups');

    const vegetables = groups.find((g) => g.name === 'Vegetables');
    assert.equal(vegetables?.count, 133, 'Expected 133 vegetable commodities');
  });

  await t.test('2. should filter commodities by group name', () => {
    const pulses = controller.commodities('Pulses', undefined, '50');
    assert(Array.isArray(pulses), 'Expected array of pulses');
    assert(pulses.length > 0, 'Expected pulses to have items');
    for (const p of pulses) {
      assert.equal(p.group_name, 'Pulses', `Expected ${p.cmdt_name} to be in Pulses`);
    }
  });

  await t.test('3. should search commodities by name or keyword', () => {
    const wheatItems = controller.commodities(undefined, 'Wheat');
    assert(Array.isArray(wheatItems), 'Expected array of wheat results');
    assert(wheatItems.some((w) => w.cmdt_name === 'Wheat'), 'Expected exact match for Wheat');
    assert(wheatItems.every((w) => w.cmdt_name.toLowerCase().includes('wheat') || w.group_name.toLowerCase().includes('wheat')));
  });
});
