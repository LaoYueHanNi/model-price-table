import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { activeContainer, chinaClock, contextNodes, patternMatches, peakText, priceText, resolveModel, resolvePrice, searchModels, slotMatches } from '../src/lib/pricing.ts';
import type { Costs, DailySlot, Model, PricingTable } from '../src/lib/pricing.ts';
import { familyLabel, messages, ruleLabel } from '../src/lib/i18n.ts';

const costs = (value: number): Costs => ({ inputCostPerMillion: value, outputCostPerMillion: value * 2, cacheReadCostPerMillion: value / 10, cacheCreationCostPerMillion: value * 1.25 });
const model = (value = 1): Model => ({ modelId: 'example', ...costs(value) });
const seconds = (iso: string) => Date.parse(iso) / 1000;
const monday = seconds('2026-10-12T09:00:00+08:00');
const slot: DailySlot = { label: 'peak', ...costs(10), daysOfWeek: [1, 2, 3, 4, 5], windows: [{ startMinute: 480, endMinute: 720 }] };
const source = JSON.parse(readFileSync(new URL('../../model_pricing.json', import.meta.url), 'utf8')) as PricingTable;

test('daily schedules use China time, ISO weekdays, and half-open minute boundaries', () => {
  assert.deepEqual(chinaClock(seconds('2026-10-11T16:00:00Z')), { minute: 0, weekday: 1 });
  assert.deepEqual(chinaClock(seconds('1990-07-01T00:00:00Z')), { minute: 540, weekday: 7 });
  assert.equal(slotMatches(slot, seconds('2026-10-12T07:59:59+08:00')), false);
  assert.equal(slotMatches(slot, seconds('2026-10-12T08:00:00+08:00')), true);
  assert.equal(slotMatches(slot, seconds('2026-10-12T11:59:59+08:00')), true);
  assert.equal(slotMatches(slot, seconds('2026-10-12T12:00:00+08:00')), false);
  assert.equal(slotMatches(slot, seconds('2026-10-17T09:00:00+08:00')), false);
  assert.equal(slotMatches({ ...slot, daysOfWeek: undefined }, seconds('2026-10-17T09:00:00+08:00')), true);
  assert.equal(slotMatches({ ...slot, daysOfWeek: [7], windows: [{ startMinute: 1380, endMinute: 1440 }] }, seconds('2026-10-11T23:59:59+08:00')), true);
});

test('absolute periods include both endpoints and fall back to the model outside them', () => {
  const root: Model = { ...model(), timeRules: [{ label: 'sale', startTime: 100, endTime: 200, ...costs(2) }] };
  assert.equal(activeContainer(root, 99), root);
  assert.equal(activeContainer(root, 100), root.timeRules![0]);
  assert.equal(activeContainer(root, 200), root.timeRules![0]);
  assert.equal(activeContainer(root, 201), root);
});

test('unordered context tiers form exact, inclusive-lower and exclusive-upper bands without mutation', () => {
  const root = { ...model(), contextTiers: [{ threshold: 200, ...costs(3) }, { threshold: 100, ...costs(2) }] };
  const before = JSON.stringify(root);
  assert.deepEqual(contextNodes(root).map(({ minimum, maximum }) => [minimum, maximum]), [[0, 100], [100, 200], [200, undefined]]);
  assert.equal(resolvePrice(root, monday, 99).inputCostPerMillion, 1);
  assert.equal(resolvePrice(root, monday, 100).inputCostPerMillion, 2);
  assert.equal(resolvePrice(root, monday, 200).inputCostPerMillion, 3);
  assert.equal(JSON.stringify(root), before);
  assert.deepEqual(contextNodes({ ...root, contextTiers: [{ threshold: 0, ...costs(4) }] }).map(node => node.minimum), [0]);
});

test('a matched context tier never inherits the root peak rule', () => {
  const root = { ...model(), dailySlots: [slot], contextTiers: [{ threshold: 100, ...costs(2) }] };
  assert.equal(resolvePrice(root, monday, 0), slot);
  assert.equal(resolvePrice(root, monday, 100), root.contextTiers[0]);
});

test('time rules own their context tiers and slots, including root fallback when that period ends', () => {
  const tierPeak = { ...slot, ...costs(50) };
  const period = { label: 'period', startTime: monday, endTime: monday + 1, ...costs(20), contextTiers: [{ threshold: 100, ...costs(30), dailySlots: [tierPeak] }] };
  const root = { ...model(), dailySlots: [slot], contextTiers: [{ threshold: 100, ...costs(3) }], timeRules: [period] };
  assert.equal(resolvePrice(root, monday, 99), period);
  assert.equal(resolvePrice(root, monday, 100), tierPeak);
  assert.equal(resolvePrice(root, monday + 2, 100), root.contextTiers[0]);
});

test('identity resolution observes global precedence, ASCII folding, and ambiguity errors', () => {
  const models: Model[] = [
    { ...model(), modelId: 'EXAMPLE' },
    { ...model(), modelId: 'alias-owner', aliases: ['example'] },
    { ...model(), modelId: 'pattern-owner', aliasPatterns: ['^example$', '^EXAMPLE$'] },
  ];
  assert.equal(resolveModel(models.slice().reverse(), 'eXaMpLe'), models[0]);
  assert.equal(resolveModel(models.slice(1).reverse(), 'EXAMPLE'), models[1]);
  assert.equal(resolveModel(models.slice(2), 'EXAMPLE'), models[2]);
  assert.throws(() => resolveModel([models[0]!, { ...model(), modelId: 'example' }], 'EXAMPLE'), /Ambiguous/);
  assert.equal(patternMatches('^example$', 'example\n'), false);
  assert.equal(resolveModel(models, 'provider/example'), undefined);
  assert.equal(resolveModel(models, 'example-fast'), undefined);
});

test('the actual table resolves every ID and historical alias with variants kept isolated', () => {
  for (const entry of source.models) {
    for (const name of [entry.modelId, ...(entry.aliases ?? [])]) {
      assert.equal(resolveModel(source.models, name.toUpperCase()), entry);
    }
  }
  assert.equal(resolveModel(source.models, 'grok-4.7-high-fast')?.modelId, 'grok-4.7-fast');
  assert.equal(resolveModel(source.models, 'grok-4.7-high')?.modelId, 'grok-4.7');
  assert.equal(resolveModel(source.models, 'gpt-5.1-codex-max-high')?.modelId, 'gpt-5.1-codex-max');
  assert.equal(resolveModel(source.models, 'grok-4.7-high-fast\n'), undefined);
});

test('search accepts partial names and exact pattern aliases without matching regex source text', () => {
  const models = [{ ...model(), modelId: 'example-main', aliases: ['old-name'], aliasPatterns: ['^api(-(high|low))?$'] }];
  assert.equal(searchModels(models, 'MAIN').length, 1);
  assert.equal(searchModels(models, 'old').length, 1);
  assert.equal(searchModels(models, 'API-high').length, 1);
  assert.equal(searchModels(models, 'high|low').length, 0);
  assert.equal(searchModels(models, 'api-fast').length, 0);
});

test('currency conversion preserves zero and tiny nonzero prices and describes multiple peak rates', () => {
  assert.equal(priceText(7, 'USD', 7), '1');
  assert.equal(priceText(0, 'RMB', 7), '0');
  assert.equal(priceText(0.000000001, 'RMB', 7), '0.000000001');
  const node = { ...costs(1), dailySlots: [slot, { ...slot, ...costs(20) }] };
  assert.equal(peakText(node, 'inputCostPerMillion', 'RMB', 7), '10–20');
  assert.equal(peakText(model(), 'inputCostPerMillion', 'RMB', 7), undefined);
});

test('both languages cover all interface keys and existing rule labels', () => {
  assert.deepEqual(Object.keys(messages.zh).sort(), Object.keys(messages.en).sort());
  for (const entry of source.models) {
    for (const container of [entry, ...(entry.timeRules ?? [])]) {
      if ('label' in container) assert.doesNotMatch(ruleLabel(container.label, 'en'), /[\u4e00-\u9fff]/);
      for (const node of [container, ...(container.contextTiers ?? [])]) {
        for (const daily of node.dailySlots ?? []) assert.doesNotMatch(ruleLabel(daily.label, 'en'), /[\u4e00-\u9fff]/);
      }
    }
  }
  assert.equal(familyLabel('tencent', '腾讯', 'en'), 'Tencent');
});
