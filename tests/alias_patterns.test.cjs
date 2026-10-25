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
// Keep legacy aliases as regression inputs only for the two-stage acceptance path.
const modelsWithoutAliases = table.models.map(({ aliases, ...model }) => model);

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
    ['muse-wonder-1.0', 'muse-wonder'],
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

test('confirmed historical aliases work without the deprecated aliases stage', () => {
  // Mimic consumers using only modelId and aliasPatterns. Historical aliases
  // must not mask missing pattern coverage in these regression checks.
  const withoutAliases = table.models.map(model => ({ ...model, aliases: [] }));
  for (const [modelId, names] of [
    ['deepseek-v4-flash', ['deepseek-v4-flash', 'deepseek-v4-flash-0731']],
    ['deepseek-v4.1-flash', ['deepseek-flash']],
    ['ox-alpha', ['ox-alpha-free']],
  ]) {
    for (const name of names) {
      for (const variant of caseVariants(name)) {
        assert.deepEqual(patternHits(variant), [modelId], variant);
        assert.equal(resolveModel(variant, withoutAliases), modelId, variant);
        for (const suffix of ['-high', '-fast', '-mini', '-pro', '-unknown', 'x', '\n', '\r\n']) {
          const unknown = variant + suffix;
          assert.deepEqual(patternHits(unknown), [], JSON.stringify(unknown));
          assert.equal(resolveModel(unknown, withoutAliases), null, JSON.stringify(unknown));
        }
        assert.deepEqual(patternHits(`provider/${variant}`), [], variant);
        assert.equal(resolveModel(`provider/${variant}`, withoutAliases), null, variant);
      }
    }
  }
  for (const modelId of ['deepseek-v4.1-flash', 'ox-alpha']) {
    for (const variant of caseVariants(modelId)) {
      assert.equal(resolveModel(variant, withoutAliases), modelId, variant);
    }
  }
  for (const name of ['deepseek-v4-flash-0732', 'deepseek-v4.1-flash-0731']) {
    for (const variant of caseVariants(name)) {
      assert.deepEqual(patternHits(variant), [], variant);
      assert.equal(resolveModel(variant, withoutAliases), null, variant);
    }
  }
});

test('every historical alias and model ID resolves uniquely without aliases or prefix normalization', () => {
  for (const model of table.models) {
    for (const name of [model.modelId, ...(model.aliases ?? [])]) {
      for (const variant of caseVariants(name)) {
        assert.equal(resolveModel(variant, modelsWithoutAliases), model.modelId, variant);
        const hits = patternHits(variant);
        if (name.toLowerCase() !== model.modelId.toLowerCase()) {
          assert.deepEqual(hits, [model.modelId], variant);
        } else {
          // Exact-ID precedence must not hide a pattern capturing another model.
          for (const hit of hits) assert.equal(hit, model.modelId, variant);
        }
      }
    }
  }
});

test('all historical names reject unknown suffixes, prefixes and trailing newlines', () => {
  for (const model of table.models) {
    for (const name of [model.modelId, ...(model.aliases ?? [])]) {
      for (const variant of caseVariants(name)) {
        for (const unknown of [
          `${variant}-unconfirmed-suffix`, `${variant}-20991231`,
          `unknown-provider/${variant}`, `${variant}\n`, `${variant}\r\n`,
        ]) {
          assert.deepEqual(patternHits(unknown), [], JSON.stringify(unknown));
          assert.equal(resolveModel(unknown, modelsWithoutAliases), null, JSON.stringify(unknown));
        }
      }
    }
  }
});

test('historical literal aliases preserve punctuation and mandatory model variants', () => {
  for (const [name, modelId] of [
    ['claude-fable-5-1', 'Claude-Fable-5.1'],
    ['claude-opus-4-8', 'Claude-Opus-4.8'],
    ['claude-opus-5-5-fast', 'Claude-Opus-5.5-Fast'],
    ['deepseek-v4-pro-0813', 'deepseek-v4-pro'],
    ['nemotron-3-super-120b-a12b:free', 'nemotron-3-super'],
    ['stealth/ox-alpha', 'ox-alpha'],
    ['kwaipilot/kat-coder-pro-v2.5', 'kat-coder-pro-v2.5'],
  ]) {
    for (const variant of caseVariants(name)) {
      assert.deepEqual(patternHits(variant), [modelId], variant);
      for (const suffix of ['-fast', '-mini', '-pro']) {
        assert.deepEqual(patternHits(variant + suffix), [], variant + suffix);
        assert.equal(resolveModel(variant + suffix, modelsWithoutAliases), null, variant + suffix);
      }
    }
  }
  for (const name of [
    'claude-fable-5-1-fast', 'claude-opus-4-8-fast',
    'deepseek-v4-0813', 'deepseek-v4-mini-0813',
    'nemotron-3-super-120b-a12b-free', 'nemotron-3-super-120b-a12b/free',
    'stealth-ox-alpha', 'kwaipilot/kat-coder-v2.5',
    'minimin-m2x7', 'deepseek-v4x1-flash-expires-on-0910',
    'muse-wonder-full', 'muse-wonder-full-1.0', 'muse-wonder-1.0-fast',
  ]) {
    for (const variant of caseVariants(name)) {
      assert.deepEqual(patternHits(variant), [], variant);
      assert.equal(resolveModel(variant, modelsWithoutAliases), null, variant);
    }
  }
});

test('patterns are unique, anchored, and use bounded portable syntax', () => {
  assert.ok(patterns.length > 0);
  for (const model of table.models) {
    const values = model.aliasPatterns ?? [];
    assert.equal(new Set(values).size, values.length, model.modelId);
  }
  for (const { pattern } of patterns) {
    assert.ok(pattern.startsWith('^') && pattern.endsWith('$'), pattern);
    // Literal dots must be escaped; / and : are literal characters without delimiters.
    // No wildcard, unbounded quantifier or stored flags.
    const unescaped = pattern.replace(/\\[.\-]/g, '');
    assert.match(unescaped, /^\^[a-z0-9\-/:()|?]+\$$/i, pattern);
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

test('Gemini 4 Argon thinking levels share its price and reject other identities', () => {
  for (const effort of ['low', 'medium', 'high']) {
    for (const variant of caseVariants(`gemini-4-argon-${effort}`)) {
      assert.deepEqual(patternHits(variant), ['gemini-4-argon'], variant);
      assert.equal(resolveModel(variant), 'gemini-4-argon', variant);
    }
  }
  for (const name of [
    'gemini-4-argon-fast', 'gemini-4-argon-pro', 'gemini-4-argon-mini',
    'gemini-4-argon-high-fast', 'gemini-4-argon-fast-high',
    'gemini-4-argon-xhigh', 'gemini-4-argon-max', 'gemini-4-argon-extra-high',
    'gemini-4-argon-minimal', 'gemini-4-argon-ultra', 'gemini-4-argon-n',
    'gemini-4-argon-thinking', 'gemini-4-argon-thinking-high',
    'gemini-4-argon-cyber-permissive', 'gemini-4-argon-high\n',
  ]) {
    for (const variant of caseVariants(name)) {
      assert.deepEqual(patternHits(variant), [], JSON.stringify(variant));
      assert.equal(resolveModel(variant), null, JSON.stringify(variant));
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
      // The historically confirmed Opus Fast base now has its own literal rule;
      // it must identify the Fast model, never the ordinary Opus model.
      assert.deepEqual(patternHits(`${base}-${suffix}`),
        family === 'opus' && suffix === 'fast' ? ['Claude-Opus-5.5-Fast'] : []);
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

test('MiniMax M3.1 Flash resolves its official ID and the retired Preview name', () => {
  for (const variant of caseVariants('MiniMax-M3.1-Flash')) {
    assert.equal(resolveModel(variant), 'MiniMax-M3.1-Flash', variant);
    assert.deepEqual(patternHits(variant), [], variant);
  }
  for (const name of ['MiniMax-M3.1-Flash-Preview', 'minimax-m3.1-flash-preview']) {
    for (const variant of caseVariants(name)) {
      assert.deepEqual(patternHits(variant), ['MiniMax-M3.1-Flash'], variant);
      assert.equal(resolveModel(variant, modelsWithoutAliases), 'MiniMax-M3.1-Flash', variant);
    }
  }
  for (const name of [
    'MiniMax-M3.1-Flash-fast', 'MiniMax-M3.1-Flash-high', 'MiniMax-M3.1-Flash-max',
    'MiniMax-M3.1-Flash-Preview-high', 'minimax-m3.1-flash-preview-fast',
    'provider/minimax-m3.1-flash-preview', 'MiniMax-M3.1-Flash-Preview\n',
  ]) {
    for (const variant of caseVariants(name)) {
      assert.deepEqual(patternHits(variant), [], JSON.stringify(variant));
      assert.equal(resolveModel(variant, modelsWithoutAliases), null, JSON.stringify(variant));
    }
  }
});

test('Kimi K3.1 Pro and its Highspeed variant keep separate identities', () => {
  for (const modelId of ['kimi-k3.1-pro', 'kimi-k3.1-pro-highspeed']) {
    for (const variant of caseVariants(modelId)) {
      assert.equal(resolveModel(variant), modelId, variant);
      assert.deepEqual(patternHits(variant), [], variant);
    }
  }
  for (const variant of caseVariants('kimi-k3')) {
    assert.equal(resolveModel(variant), 'kimi-k3', variant);
  }
  for (const name of [
    'kimi-k3.1', 'kimi-k3-1-pro', 'kimi-k3.1-pro-fast', 'kimi-k3.1-pro-mini',
    'kimi-k3.1-pro-highspeed-fast', 'provider/kimi-k3.1-pro', 'kimi-k3.1-pro\n',
  ]) {
    for (const variant of caseVariants(name)) {
      assert.deepEqual(patternHits(variant), [], JSON.stringify(variant));
      assert.equal(resolveModel(variant, modelsWithoutAliases), null, JSON.stringify(variant));
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
