import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import Ajv from 'ajv';

const schema = JSON.parse(readFileSync(new URL('../../model_pricing.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addFormat('regex', value => { try { new RegExp(value, 'i'); return true; } catch { return false; } });
const schemaValid = ajv.compile(schema);
const fold = value => value.replace(/[A-Z]/g, letter => letter.toLowerCase());

export function validatePricing(table) {
  if (!schemaValid(table)) throw new Error(ajv.errorsText(schemaValid.errors, { separator: '\n' }));
  const fail = message => { throw new Error(message); };
  const unique = (values, path) => {
    if (new Set(values).size !== values.length) fail(`${path}: duplicate values`);
  };
  unique(table.models.map(model => fold(model.modelId)), 'models.modelId');
  unique((table.families ?? []).map(family => family.id), 'families.id');
  if (table.usdExchangeRate !== undefined && table.usdExchangeRate <= 0) fail('usdExchangeRate must be positive for currency conversion');
  const aliasOwners = new Map();
  const patterns = [];
  function nodeValid(node, path) {
    const slots = node.dailySlots ?? [];
    for (const slot of slots) {
      for (const window of slot.windows) {
        if (window.startMinute >= window.endMinute) fail(`${path}: invalid daily window`);
      }
    }
    for (let a = 0; a < slots.length; a++) {
      for (let b = a; b < slots.length; b++) {
        const left = slots[a];
        const right = slots[b];
        const days = left.daysOfWeek ?? [1, 2, 3, 4, 5, 6, 7];
        if (!(right.daysOfWeek ?? [1, 2, 3, 4, 5, 6, 7]).some(day => days.includes(day))) continue;
        for (let i = 0; i < left.windows.length; i++) {
          for (let j = a === b ? i + 1 : 0; j < right.windows.length; j++) {
            const x = left.windows[i];
            const y = right.windows[j];
            if (x.startMinute < y.endMinute && y.startMinute < x.endMinute) fail(`${path}: overlapping daily windows`);
          }
        }
      }
    }
    unique((node.contextTiers ?? []).map(tier => tier.threshold), `${path}.contextTiers.threshold`);
    for (const tier of node.contextTiers ?? []) nodeValid(tier, `${path}.tier(${tier.threshold})`);
  }
  for (const model of table.models) {
    nodeValid(model, model.modelId);
    const rules = [...(model.timeRules ?? [])].sort((a, b) => a.startTime - b.startTime);
    for (let index = 0; index < rules.length; index++) {
      const rule = rules[index];
      if (rule.startTime > rule.endTime) fail(`${model.modelId}: invalid absolute time range`);
      if (index && rules[index - 1].endTime >= rule.startTime) fail(`${model.modelId}: overlapping absolute time ranges`);
      nodeValid(rule, `${model.modelId}.timeRule(${index})`);
    }
    for (const alias of model.aliases ?? []) {
      const owner = aliasOwners.get(fold(alias));
      if (owner && owner !== model.modelId) fail(`Ambiguous historical alias: ${alias}`);
      aliasOwners.set(fold(alias), model.modelId);
    }
    for (const pattern of model.aliasPatterns ?? []) {
      const literals = pattern.replace(/\\[.\-]/g, '');
      if (!/^\^[a-z0-9\-/:()|?]+\$$/i.test(literals) || pattern.includes('(?')) fail(`Nonportable alias pattern: ${pattern}`);
      patterns.push({ owner: model.modelId, regex: new RegExp(pattern, 'i') });
    }
  }
  for (const model of table.models) {
    for (const name of [model.modelId, ...(model.aliases ?? [])]) {
      const aliasOwner = aliasOwners.get(fold(name));
      if (aliasOwner && aliasOwner !== model.modelId) fail(`Cross-model exact name: ${name}`);
      for (const { owner, regex } of patterns) {
        const match = regex.exec(name);
        if (match?.index === 0 && match[0].length === name.length && owner !== model.modelId) fail(`Cross-model alias pattern: ${name}`);
      }
    }
  }
  return table;
}

export function readValidatedSource() {
  const source = readFileSync(new URL('../../model_pricing.json', import.meta.url), 'utf8');
  validatePricing(JSON.parse(source));
  return source;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const table = JSON.parse(readValidatedSource());
  console.log(`Pricing data validated: ${table.models.length} models, version ${table.version}`);
}
