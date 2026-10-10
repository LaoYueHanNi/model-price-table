const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const table = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'model_pricing.json'), 'utf8'));
const patterns = table.models.flatMap(model => (model.aliasPatterns ?? []).map(pattern => ({
  modelId: model.modelId,
  regex: new RegExp(pattern),
  pattern,
})));

// Consumer contract: anchors alone may accept a trailing newline in some engines.
function patternHits(name) {
  return [...new Set(patterns.filter(({ regex }) => {
    const match = regex.exec(name);
    return match && match.index === 0 && match[0].length === name.length;
  }).map(({ modelId }) => modelId))];
}

test('patterns are unique, anchored, and use bounded portable syntax', () => {
  assert.ok(patterns.length > 0);
  for (const model of table.models) {
    const values = model.aliasPatterns ?? [];
    assert.equal(new Set(values).size, values.length, model.modelId);
  }
  for (const { pattern } of patterns) {
    assert.ok(pattern.startsWith('^') && pattern.endsWith('$'), pattern);
    // Literal dots must be escaped; no wildcard, unbounded quantifier or flags.
    const unescaped = pattern.replace(/\\[.\-]/g, '');
    assert.match(unescaped, /^\^[a-z0-9\-()|?]+\$$/, pattern);
    assert.ok(!pattern.includes('(?'), pattern);
  }
});

test('no known model ID or exact alias is captured by a different model', () => {
  for (const model of table.models) {
    for (const name of [model.modelId, ...(model.aliases ?? [])]) {
      for (const hit of patternHits(name)) assert.equal(hit, model.modelId, name);
    }
  }
});

test('all existing thinking and effort aliases have regex coverage', () => {
  for (const model of table.models) {
    for (const name of model.aliases ?? []) {
      if (/(?:^|-)(?:think|thinking)(?:-|$)/.test(name)
        || /-(?:minimal|low|medium|high|extra-high|xhigh|max|ultra)(?:-fast)?$/.test(name)) {
        assert.deepEqual(patternHits(name), [model.modelId], name);
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

test('unknown prefixes, suffixes, versions, casing and punctuation do not match', () => {
  for (const name of [
    'claude-opus-5-50-high', 'claude-opus-6-high', 'claude-opus-5-5-high-fast',
    'gpt-5x6-sol-high', 'grok-4x7-high', 'grok-4.7-ultra', 'grok-4.7-fast-ultra',
    'provider/grok-4.7-high', 'prefix-claude-opus-5-5-high',
    'CLAUDE-OPUS-5-5-HIGH', 'claude-opus-5-5-high\n', 'claude-opus-5-5-high\r\n',
  ]) assert.deepEqual(patternHits(name), [], JSON.stringify(name));
});
