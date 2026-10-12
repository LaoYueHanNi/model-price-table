import assert from 'node:assert/strict';
import test from 'node:test';
import { readValidatedSource, validatePricing } from '../scripts/validate-data.mjs';

const table = JSON.parse(readValidatedSource());
const fixture = () => ({ version: 1, updatedAt: 0, currency: 'RMB', models: [{ modelId: 'a', inputCostPerMillion: 1, outputCostPerMillion: 2, cacheReadCostPerMillion: 0, cacheCreationCostPerMillion: 0 }] });
const daily = daysOfWeek => ({ label: 'peak', windows: [{ startMinute: 480, endMinute: 720 }], ...(daysOfWeek ? { daysOfWeek } : {}), inputCostPerMillion: 2, outputCostPerMillion: 3, cacheReadCostPerMillion: 0, cacheCreationCostPerMillion: 0 });

test('the source validates and strict schema rejects added fields and missing costs', () => {
  assert.equal(validatePricing(table), table);
  const extra = fixture(); extra.models[0].price = 42;
  assert.throws(() => validatePricing(extra), /additional properties/);
  const missing = fixture(); delete missing.models[0].inputCostPerMillion;
  assert.throws(() => validatePricing(missing), /required property/);
});

test('overlapping schedules fail only when their weekdays intersect', () => {
  const value = fixture();
  value.models[0].dailySlots = [daily([1]), daily([2])];
  assert.doesNotThrow(() => validatePricing(value));
  value.models[0].dailySlots[1].daysOfWeek = [1];
  assert.throws(() => validatePricing(value), /overlapping daily windows/);
  value.models[0].dailySlots = [daily(), daily([7])];
  assert.throws(() => validatePricing(value), /overlapping daily windows/);
});

test('invalid windows, duplicate thresholds, and overlapping closed periods are rejected', () => {
  const value = fixture();
  value.models[0].dailySlots = [daily()];
  value.models[0].dailySlots[0].windows[0].endMinute = 480;
  assert.throws(() => validatePricing(value), /invalid daily window/);
  delete value.models[0].dailySlots;
  const cost = { inputCostPerMillion: 1, outputCostPerMillion: 2, cacheReadCostPerMillion: 0, cacheCreationCostPerMillion: 0 };
  value.models[0].contextTiers = [{ threshold: 100, ...cost }, { threshold: 100, ...cost }];
  assert.throws(() => validatePricing(value), /duplicate values/);
  delete value.models[0].contextTiers;
  value.models[0].timeRules = [{ label: 'one', startTime: 0, endTime: 100, ...cost }, { label: 'two', startTime: 100, endTime: 200, ...cost }];
  assert.throws(() => validatePricing(value), /overlapping absolute time ranges/);
});

test('case collisions, nonportable patterns, and cross-model alias matches are rejected', () => {
  const value = fixture();
  value.models.push({ ...value.models[0], modelId: 'A' });
  assert.throws(() => validatePricing(value), /duplicate values/);
  value.models[1].modelId = 'b';
  value.models[1].aliasPatterns = ['^a$'];
  assert.throws(() => validatePricing(value), /Cross-model alias pattern/);
  value.models[1].aliasPatterns = ['^b.*$'];
  assert.throws(() => validatePricing(value), /Nonportable/);
  value.models[1].aliasPatterns = [];
  value.models[0].aliases = ['shared']; value.models[1].aliases = ['SHARED'];
  assert.throws(() => validatePricing(value), /Ambiguous historical alias/);
});

test('a zero exchange rate cannot reach the currency conversion UI', () => {
  const value = fixture(); value.usdExchangeRate = 0;
  assert.throws(() => validatePricing(value), /must be positive/);
});
