const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const table = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'model_pricing.json'), 'utf8'));
const patterns = table.models.flatMap(model => (model.aliasPatterns ?? []).map(pattern => ({
  modelId: model.modelId,
  regex: new RegExp(pattern, 'i'),
  pattern,
})));

// Consumer contract: anchors alone may accept a trailing newline in some engines.
function patternHits(name) {
  return [...new Set(patterns.filter(({ regex }) => {
    const match = regex.exec(name);
    return match && match.index === 0 && match[0].length === name.length;
  }).map(({ modelId }) => modelId))];
}

function caseVariants(name) {
  return [...new Set([name, name.toLowerCase(), name.toUpperCase(),
    name.replace(/[a-z]/gi, (letter, index) => index % 2 ? letter.toLowerCase() : letter.toUpperCase())])];
}

// Test the documented consumer contract; this data repository has no runtime resolver.
function resolveModel(name, models = table.models) {
  const fold = value => value.replace(/[A-Z]/g, letter => letter.toLowerCase());
  const stages = [
    model => fold(model.modelId) === fold(name),
    model => (model.aliases ?? []).some(alias => fold(alias) === fold(name)),
    model => (model.aliasPatterns ?? []).some(pattern => {
      const match = new RegExp(pattern, 'i').exec(name);
      return match && match.index === 0 && match[0].length === name.length;
    }),
  ];
  for (const matches of stages) {
    const hits = models.filter(matches);
    if (hits.length > 1) throw new Error('ambiguous model name');
    if (hits.length === 1) return hits[0].modelId;
  }
  return null;
}

test('model IDs and historical aliases resolve in any ASCII letter case without collisions', () => {
  for (const model of table.models) {
    for (const field of ['modelId', 'aliases']) {
      for (const name of field === 'modelId' ? [model.modelId] : model.aliases ?? []) {
        for (const variant of caseVariants(name)) {
          const owners = table.models.filter(candidate =>
            (field === 'modelId' ? [candidate.modelId] : candidate.aliases ?? [])
              .some(value => value.toLowerCase() === variant.toLowerCase()));
          assert.deepEqual(owners.map(owner => owner.modelId), [model.modelId], variant);
          assert.equal(resolveModel(variant), model.modelId, variant);
        }
      }
    }
  }
});

test('case-insensitive identification keeps global stage precedence and rejects ambiguity', () => {
  const models = [
    { modelId: 'Example', aliases: [], aliasPatterns: [] },
    { modelId: 'alias-owner', aliases: ['example'], aliasPatterns: [] },
    { modelId: 'pattern-owner', aliases: [], aliasPatterns: ['^example$'] },
  ];
  assert.equal(resolveModel('EXAMPLE', models.slice().reverse()), 'Example');
  assert.equal(resolveModel('EXAMPLE', models.slice(1).reverse()), 'alias-owner');
  assert.equal(resolveModel('EXAMPLE', models.slice(2)), 'pattern-owner');
  for (const [field, values] of [
    ['modelId', ['example', 'EXAMPLE']],
    ['aliases', [['example'], ['EXAMPLE']]],
    ['aliasPatterns', [['^example$'], ['^EXAMPLE$']]],
  ]) {
    assert.throws(() => resolveModel('ExAmPlE', values.map((value, index) => ({
      modelId: `owner-${index}`, [field]: value,
    }))), /ambiguous/);
  }
  assert.equal(resolveModel('provider/EXAMPLE', models), null);
  assert.equal(resolveModel('EXAMPLE\n', models), null);
});

test('regex aliases accept uppercase and mixed case, deduplicating patterns for one model', () => {
  for (const [name, modelId] of [
    ['claude-opus-5-5-thinking-high', 'Claude-Opus-5.5'],
    ['claude-opus-5-5-high', 'Claude-Opus-5.5'],
    ['gpt-5.6-sol-high', 'gpt-5.6-sol'],
    ['grok-4.7-high-fast', 'grok-4.7-fast'],
    ['gpt-5.1-codex-max-high', 'gpt-5.1-codex-max'],
    ['gemini-3.8-flash-n', 'gemini-3.8-flash'],
  ]) {
    for (const variant of caseVariants(name)) {
      assert.deepEqual(patternHits(variant), [modelId], variant);
      assert.equal(resolveModel(variant), modelId, variant);
    }
  }
  assert.equal(resolveModel('EXAMPLE', [{
    modelId: 'owner', aliasPatterns: ['^example$', '^EXAMPLE$'],
  }]), 'owner');
});

test('patterns are unique, anchored, and use bounded portable syntax', () => {
  assert.ok(patterns.length > 0);
  for (const model of table.models) {
    const values = model.aliasPatterns ?? [];
    assert.equal(new Set(values).size, values.length, model.modelId);
  }
  for (const { pattern } of patterns) {
    assert.ok(pattern.startsWith('^') && pattern.endsWith('$'), pattern);
    // Literal dots must be escaped; no wildcard, unbounded quantifier or stored flags.
    const unescaped = pattern.replace(/\\[.\-]/g, '');
    assert.match(unescaped, /^\^[a-z0-9\-()|?]+\$$/i, pattern);
    assert.ok(!pattern.includes('(?'), pattern);
  }
});

test('no known model ID or exact alias is captured by a different model', () => {
  for (const model of table.models) {
    for (const name of [model.modelId, ...(model.aliases ?? [])]) {
      for (const variant of caseVariants(name)) {
        for (const hit of patternHits(variant)) assert.equal(hit, model.modelId, variant);
      }
    }
  }
});

test('all existing thinking and effort aliases have regex coverage', () => {
  for (const model of table.models) {
    for (const name of model.aliases ?? []) {
      if (/(?:^|-)(?:think|thinking)(?:-|$)/.test(name)
        || /-(?:minimal|low|medium|high|extra-high|xhigh|max|ultra)(?:-fast)?$/.test(name)) {
        for (const variant of caseVariants(name)) {
          assert.deepEqual(patternHits(variant), [model.modelId], variant);
        }
      }
    }
  }
});

test('Claude thinking and plain effort forms exclude Fast and unknown variants', () => {
  for (const family of ['haiku', 'sonnet', 'opus']) {
    const modelId = `Claude-${family[0].toUpperCase() + family.slice(1)}-5.5`;
    const base = `claude-${family}-5-5`;
    for (const effort of ['low', 'medium', 'high', 'extra-high', 'xhigh', 'max']) {
      for (const name of [`${base}-${effort}`, `${base}-thinking-${effort}`]) {
        assert.deepEqual(patternHits(name), [modelId], name);
        assert.deepEqual(patternHits(`${name}-fast`), [], name);
      }
      assert.deepEqual(patternHits(`${base}-fast-${effort}`), []);
    }
    for (const suffix of ['fast', 'pro', 'mini', 'thinking', 'ultra', 'thinking-ultra']) {
      assert.deepEqual(patternHits(`${base}-${suffix}`), []);
    }
  }
});

test('Grok Fast remains mandatory in both effort positions', () => {
  for (const effort of ['low', 'medium', 'high', 'xhigh']) {
    for (const name of [
      `grok-4.7-fast-${effort}`, `grok-4.7-${effort}-fast`,
      `cursor-grok-4.7-${effort}-fast`,
    ]) assert.deepEqual(patternHits(name), ['grok-4.7-fast'], name);
    for (const name of [`grok-4.7-${effort}`, `cursor-grok-4.7-${effort}`]) {
      assert.deepEqual(patternHits(name), ['grok-4.7'], name);
    }
  }
});

test('GPT Fast, codex and mini/max identity components are preserved', () => {
  for (const variant of ['sol', 'terra', 'luna']) {
    assert.deepEqual(patternHits(`gpt-5.6-${variant}-high`), [`gpt-5.6-${variant}`]);
    assert.deepEqual(patternHits(`gpt-5.6-${variant}-fast-high`), [`gpt-5.6-${variant}-fast`]);
    assert.deepEqual(patternHits(`gpt-5.6-${variant}-high-fast`), []);
  }
  assert.deepEqual(patternHits('gpt-5-codex-high'), ['gpt-5-codex']);
  assert.deepEqual(patternHits('gpt-5-codex-mini-high'), ['gpt-5-codex-mini']);
  assert.deepEqual(patternHits('gpt-5.1-codex-max-high'), ['gpt-5.1-codex-max']);
  assert.deepEqual(patternHits('gpt-5.1-codex-high'), []);
});

test('Fast aliases never match ordinary models, even without exact-match precedence', () => {
  for (const model of table.models.filter(model => /-fast$/i.test(model.modelId))) {
    for (const name of [model.modelId, ...(model.aliases ?? [])]) {
      for (const hit of patternHits(name)) assert.equal(hit, model.modelId, name);
      const ordinary = name.replace(/-fast/g, '');
      assert.ok(!patternHits(ordinary).includes(model.modelId), ordinary);
    }
  }
});

test('unknown prefixes, suffixes, versions and punctuation do not match in any case', () => {
  for (const name of [
    'claude-opus-5-50-high', 'claude-opus-6-high', 'claude-opus-5-5-high-fast',
    'gpt-5x6-sol-high', 'grok-4x7-high', 'grok-4.7-ultra', 'grok-4.7-fast-ultra',
    'provider/grok-4.7-high', 'prefix-claude-opus-5-5-high',
    'claude-opus-5-5-high-pro', 'claude-opus-5-5-high-mini',
    'gpt-5.1-codex-high', 'claude-opus-5-5-high\n', 'claude-opus-5-5-high\r\n',
    'gemini-3.8-flash-n-high', 'gemini-3.8-flash-n-fast', 'gemini-3.8-flash-nx',
  ]) {
    for (const variant of caseVariants(name)) {
      assert.deepEqual(patternHits(variant), [], JSON.stringify(variant));
      assert.equal(resolveModel(variant), null, JSON.stringify(variant));
    }
  }
});
