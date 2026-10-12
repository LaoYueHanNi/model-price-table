import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateCost, formatTokenInput, parseTokenCount, parseTokenInputs, tokenInputs, usagePresets } from '../src/lib/calculator.ts';
import type { TokenUsage } from '../src/lib/calculator.ts';
import { priceText } from '../src/lib/pricing.ts';
import type { Costs, DailySlot, Model } from '../src/lib/pricing.ts';

const prices: Costs = { inputCostPerMillion: 2, outputCostPerMillion: 8, cacheReadCostPerMillion: 0.5, cacheCreationCostPerMillion: 3 };
const root: Model = { modelId: 'example', ...prices };
const zero: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
const monday = Date.parse('2026-10-12T09:00:00+08:00') / 1000;
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test('four independent token counts produce unrounded subtotals and one total', () => {
  const estimate = estimateCost(root, { input: 1000, output: 2000, cacheRead: 3000, cacheCreation: 4000 }, monday);
  assert.deepEqual(estimate.breakdown, { input: 0.002, output: 0.016, cacheRead: 0.0015, cacheCreation: 0.012 });
  close(estimate.total, 0.0315);
  assert.equal(estimate.totalTokens, 10000);
  assert.equal(priceText(estimate.total, 'USD', 7), '0.0045');
  assert.equal(priceText(estimate.total, 'RMB', 7), '0.0315');
});

test('zero usage and tiny paid requests are preserved', () => {
  assert.deepEqual(estimateCost(root, zero, monday).breakdown, zero);
  assert.equal(estimateCost(root, zero, monday).total, 0);
  const estimate = estimateCost({ ...root, inputCostPerMillion: 0.001 }, { ...zero, input: 1 }, monday);
  assert.equal(priceText(estimate.total, 'RMB', 7), '0.000000001');
});

test('token inputs reject blank, negative, decimal, malformed and unsafe values', () => {
  for (const value of ['', ' ', '-1', '1.5', 'NaN', 'Infinity', '1e6', '1,00', ',100', '1,,000', '1000,000', 'abc', '9007199254740992', '9,007,199,254,740,992']) {
    assert.equal(parseTokenCount(value), undefined, value);
    assert.equal(parseTokenInputs({ ...tokenInputs(zero), cacheRead: value }), undefined, value);
  }
  assert.equal(parseTokenCount(' 00012 '), 12);
  assert.deepEqual(parseTokenInputs(tokenInputs(zero)), zero);
  assert.ok(parseTokenInputs({ ...tokenInputs(zero), input: String(Number.MAX_SAFE_INTEGER) }));
  assert.equal(parseTokenInputs({ ...tokenInputs(zero), input: String(Number.MAX_SAFE_INTEGER), cacheRead: '1' }), undefined);
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => estimateCost(root, { ...zero, input: value }, monday), RangeError);
  }
  assert.throws(() => estimateCost(root, { ...zero, input: Number.MAX_SAFE_INTEGER, output: 1 }, monday), RangeError);
});

test('thousands separators preserve workload prices and exact safe-integer validation', () => {
  assert.equal(formatTokenInput('10431043'), '10,431,043');
  assert.equal(formatTokenInput('10,431,043'), '10,431,043');
  const high = usagePresets[2].tokens;
  assert.equal(tokenInputs(high).cacheRead, '94,234,973');
  assert.equal(estimateCost(root, parseTokenInputs(tokenInputs(high))!, monday).total, estimateCost(root, high, monday).total);
  assert.equal(parseTokenCount(' 9,007,199,254,740,991 '), Number.MAX_SAFE_INTEGER);
  const unsafe = formatTokenInput('9007199254740993');
  assert.equal(unsafe, '9,007,199,254,740,993');
  assert.equal(parseTokenCount(unsafe), undefined);
  for (const invalid of ['-1', '1.5', '1e6', 'abc']) {
    assert.equal(formatTokenInput(invalid), invalid);
    assert.equal(parseTokenCount(formatTokenInput(invalid)), undefined);
  }
});

test('cost comparisons ignore all context tiers, including zero and large thresholds', () => {
  const model = { ...root, contextTiers: [
    { threshold: 0, inputCostPerMillion: 100, outputCostPerMillion: 100, cacheReadCostPerMillion: 100, cacheCreationCostPerMillion: 100 },
    { threshold: 100, inputCostPerMillion: 200, outputCostPerMillion: 200, cacheReadCostPerMillion: 200, cacheCreationCostPerMillion: 200 },
  ] };
  for (const input of [0, 99, 100, 100000000]) {
    const usage = { input, cacheRead: 100000000, output: 100000000, cacheCreation: 100000000 };
    const estimate = estimateCost(model, usage, monday);
    assert.equal(estimate.price, model);
    assert.equal(estimate.totalTokens, input + 300000000);
    close(estimate.total, input / 1000000 * 2 + 50 + 800 + 300);
  }
});

test('estimates use only the base node’s peak schedule with China time boundaries', () => {
  const peak: DailySlot = { label: 'peak', ...prices, outputCostPerMillion: 20, daysOfWeek: [1], windows: [{ startMinute: 480, endMinute: 720 }] };
  const model = { ...root, dailySlots: [peak], contextTiers: [{ threshold: 100, ...prices, inputCostPerMillion: 10 }] };
  assert.equal(estimateCost(model, { ...zero, output: 1000000 }, monday).total, 20);
  assert.equal(estimateCost(model, { ...zero, input: 100000000, output: 1000000 }, monday).slot, peak);
  const onlyTierPeak = { ...model, dailySlots: [], contextTiers: [{ ...model.contextTiers[0]!, dailySlots: [peak] }] };
  assert.equal(estimateCost(onlyTierPeak, { ...zero, input: 100000000 }, monday).slot, undefined);
  assert.equal(estimateCost(onlyTierPeak, { ...zero, input: 100000000 }, monday).total, 200);
  const noon = Date.parse('2026-10-12T12:00:00+08:00') / 1000;
  assert.equal(estimateCost(model, { ...zero, input: 100 }, noon).slot, undefined);
  assert.equal(estimateCost(model, { ...zero, input: 100 }, monday + 86400).slot, undefined);
});

test('absolute price periods supply base prices without borrowing tiers or root slots', () => {
  const peak: DailySlot = { label: 'root peak', ...prices, inputCostPerMillion: 100, windows: [{ startMinute: 0, endMinute: 1440 }] };
  const period = { label: 'sale', startTime: monday, endTime: monday + 1, ...prices, inputCostPerMillion: 1, contextTiers: [{ threshold: 100, ...prices, inputCostPerMillion: 5 }] };
  const model = { ...root, dailySlots: [peak], timeRules: [period] };
  const usage = { ...zero, input: 100 };
  const estimate = estimateCost(model, usage, monday);
  assert.equal(estimate.container, period);
  assert.equal(estimate.price, period);
  assert.equal(estimate.slot, undefined);
  assert.equal(estimate.total, 0.0001);
  assert.equal(estimateCost(model, usage, monday + 1).total, 0.0001);
  assert.equal(estimateCost(model, usage, monday + 2).total, 0.01);
});

test('translation uses 100M input and 100M output with no cache', () => {
  const translation = usagePresets[0];
  assert.equal(usagePresets.length, 4);
  assert.deepEqual(parseTokenInputs(tokenInputs(translation.tokens)), { input: 100000000, output: 100000000, cacheRead: 0, cacheCreation: 0 });
});

test('coding cases preserve screenshot ratios to one token and total exactly 100M', () => {
  const sourceCounts = [
    { input: 2300000, output: 597700, cacheRead: 146100000, cacheCreation: 0 },
    { input: 18800000, output: 2300000, cacheRead: 344900000, cacheCreation: 0 },
    { input: 11700000, output: 565200, cacheRead: 99900000, cacheCreation: 0 },
  ];
  usagePresets.slice(1).forEach((preset, index) => {
    const source = sourceCounts[index]!;
    const sourceTotal = Object.values(source).reduce((sum, count) => sum + count, 0);
    assert.equal(Object.values(preset.tokens).reduce<number>((sum, count) => sum + count, 0), 100000000);
    assert.equal(preset.tokens.cacheCreation, 0);
    for (const field of ['input', 'output', 'cacheRead', 'cacheCreation'] as const) {
      assert.ok(Number.isSafeInteger(preset.tokens[field]));
      assert.ok(Math.abs(preset.tokens[field] - source[field] / sourceTotal * 100000000) < 1);
    }
    assert.deepEqual(parseTokenInputs(tokenInputs(preset.tokens)), preset.tokens);
  });
});

test('editing a normalized case does not change other cases or their source values', () => {
  const [, large, high, low] = usagePresets;
  const input = tokenInputs(high.tokens);
  input.cacheRead = '0';
  assert.equal(high.tokens.cacheRead, 94234973);
  assert.equal(large.tokens.cacheRead, 98055205);
  assert.equal(low.tokens.cacheRead, 89065058);
  assert.ok(estimateCost(root, large.tokens, monday).total < estimateCost(root, high.tokens, monday).total);
  assert.ok(estimateCost(root, high.tokens, monday).total < estimateCost(root, low.tokens, monday).total);
});
