<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue';
import AppIcon from './components/AppIcon.vue';
import ModelDetails from './components/ModelDetails.vue';
import CostCalculator from './components/CostCalculator.vue';
import CostBreakdown from './components/CostBreakdown.vue';
import { estimateCost, parseTokenInputs, tokenInputs, usagePresets } from './lib/calculator.ts';
import { activeContainer, contextNodes, costFields, dateText, foldAscii, peakText, priceText, resolveModel, searchModels } from './lib/pricing.ts';
import type { CostField, Currency, Language, Model, PricingTable } from './lib/pricing.ts';
import { familyLabel, text } from './lib/i18n.ts';

const parameters = new URLSearchParams(location.search);
function preference(key: string) {
  try { return parameters.get(key) ?? localStorage.getItem(`model-pricing-${key}`); } catch { return parameters.get(key); }
}
const preferredLanguage = preference('lang');
const language = ref<Language>(preferredLanguage === 'en' || preferredLanguage === 'zh' ? preferredLanguage : navigator.language.startsWith('zh') ? 'zh' : 'en');
const currency = ref<Currency>(preference('currency') === 'USD' ? 'USD' : 'RMB');
const query = ref(parameters.get('q') ?? '');
const selectedFamily = ref(parameters.get('family') ?? '');
const sort = ref<'source' | 'name' | 'total' | 'totalDesc' | CostField>('source');
const showCalculator = ref(false);
const calculatorExpanded = ref(false);
const calculatorToggle = ref<HTMLButtonElement>();
const calculatorInputs = ref(tokenInputs(usagePresets[0]!.tokens));
const calculatorUsage = computed(() => showCalculator.value ? parseTokenInputs(calculatorInputs.value) : undefined);
const opened = ref(new Set<string>());
const table = ref<PricingTable>();
const loading = ref(true);
const loadFailed = ref(false);
const now = ref(Math.floor(Date.now() / 1000));
let timer: ReturnType<typeof setInterval>;
let request: AbortController | undefined;
let followingModelLink = false;
const t = (key: Parameters<typeof text>[1]) => text(language.value, key);
const rate = computed(() => table.value?.usdExchangeRate ?? 7);
const sourceUrl = 'https://github.com/LaoYueHanNi/model-price-table';
const dataUrl = `${import.meta.env.BASE_URL}model_pricing.json`;
const labels = ['input', 'output', 'cacheRead', 'cacheCreation'] as const;

watchEffect(() => {
  document.documentElement.lang = language.value === 'zh' ? 'zh-CN' : 'en';
  document.title = language.value === 'zh' ? '模型定价表 · Model Price Table' : 'Model Price Table · LLM Pricing';
  try {
    localStorage.setItem('model-pricing-lang', language.value);
    localStorage.setItem('model-pricing-currency', currency.value);
  } catch { /* Browsing still works when storage is disabled. */ }
});
watch([language, currency, query, selectedFamily], (values, previous) => {
  const url = new URL(location.href);
  url.searchParams.set('lang', language.value);
  url.searchParams.set('currency', currency.value);
  if (query.value) url.searchParams.set('q', query.value); else url.searchParams.delete('q');
  if (selectedFamily.value) url.searchParams.set('family', selectedFamily.value); else url.searchParams.delete('family');
  if (!followingModelLink && (values[2] !== previous[2] || values[3] !== previous[3]) && url.hash.startsWith('#model=')) url.hash = '';
  history.replaceState(null, '', url);
});

const families = computed(() => {
  const values = new Map((table.value?.families ?? []).map(family => [family.id, family.label]));
  for (const model of table.value?.models ?? []) {
    const id = model.family ?? 'unassigned';
    if (!values.has(id)) values.set(id, undefined);
  }
  return [...values].map(([id, label]) => ({
    id, label: familyLabel(id, label, language.value),
    count: table.value?.models.filter(model => (model.family ?? 'unassigned') === id).length ?? 0,
  }));
});
const familyName = (model: Model) => families.value.find(family => family.id === (model.family ?? 'unassigned'))?.label ?? model.family;
const searchResult = computed(() => {
  try { return { models: searchModels(table.value?.models ?? [], query.value), ambiguous: false }; }
  catch { return { models: [], ambiguous: true }; }
});
const exactMatch = computed(() => {
  if (!query.value || searchResult.value.ambiguous) return undefined;
  const model = resolveModel(table.value?.models ?? [], query.value);
  return model && foldAscii(model.modelId) !== foldAscii(query.value) ? model : undefined;
});
const rows = computed(() => {
  const models = searchResult.value.models.filter(model => !selectedFamily.value || (model.family ?? 'unassigned') === selectedFamily.value);
  const prepared = models.map(model => {
    const container = activeContainer(model, now.value);
    const bands = contextNodes(container);
    const estimate = calculatorUsage.value ? estimateCost(model, calculatorUsage.value, now.value) : undefined;
    return { model, node: bands[0]!.node, hasTiers: bands.length > 1, hasPeak: bands.some(band => band.node.dailySlots?.length), estimate };
  });
  if (sort.value === 'name') prepared.sort((a, b) => a.model.modelId.localeCompare(b.model.modelId, 'en'));
  else if (sort.value === 'total' || sort.value === 'totalDesc') {
    const direction = sort.value === 'totalDesc' ? -1 : 1;
    prepared.sort((a, b) => direction * ((a.estimate?.total ?? 0) - (b.estimate?.total ?? 0)) || a.model.modelId.localeCompare(b.model.modelId, 'en'));
  }
  else if (sort.value !== 'source') {
    const field = sort.value;
    prepared.sort((a, b) => a.node[field] - b.node[field] || a.model.modelId.localeCompare(b.model.modelId, 'en'));
  }
  return prepared;
});
const resultsText = computed(() => t('results').replace('{count}', String(rows.value.length)).replace('{total}', String(table.value?.models.length ?? 0)));
const sortOptions = computed(() => [
  { value: 'source', label: t('sourceOrder') }, { value: 'name', label: t('nameOrder') },
  { value: 'inputCostPerMillion', label: t('inputOrder') }, { value: 'outputCostPerMillion', label: t('outputOrder') },
  { value: 'cacheReadCostPerMillion', label: t('readOrder') }, { value: 'cacheCreationCostPerMillion', label: t('creationOrder') },
  ...(showCalculator.value ? [{ value: 'total', label: t('estimateOrder') }, { value: 'totalDesc', label: t('estimateDescending') }] : []),
]);

function toggleCalculatorPanel() {
  showCalculator.value = true;
  calculatorExpanded.value = !calculatorExpanded.value;
}
function minimizeCalculator() {
  calculatorExpanded.value = false;
  calculatorToggle.value?.focus({ preventScroll: true });
}
function disableCalculator() {
  showCalculator.value = false;
  minimizeCalculator();
  if (sort.value === 'total' || sort.value === 'totalDesc') sort.value = 'source';
}
function toggleEstimateSort() {
  sort.value = sort.value === 'total' ? 'totalDesc' : 'total';
}

function toggleModel(id: string) {
  const next = new Set(opened.value);
  if (next.has(id)) next.delete(id); else next.add(id);
  opened.value = next;
}
function reset() { query.value = ''; selectedFamily.value = ''; sort.value = 'source'; }
async function followModelLink() {
  if (!location.hash.startsWith('#model=')) return;
  let id: string;
  try { id = decodeURIComponent(location.hash.slice(7)); } catch { return; }
  const model = table.value?.models.find(model => model.modelId === id);
  if (!model) return;
  followingModelLink = true;
  reset();
  opened.value = new Set([...opened.value, id]);
  await nextTick();
  const row = document.getElementById(`model-${id}`);
  row?.scrollIntoView({ block: 'start', behavior: 'instant' });
  row?.querySelector('button')?.focus({ preventScroll: true });
  followingModelLink = false;
}
async function loadData() {
  request?.abort();
  request = new AbortController();
  const controller = request;
  const timeout = setTimeout(() => controller.abort(), 15000);
  loading.value = true;
  loadFailed.value = false;
  try {
    const response = await fetch(dataUrl, { signal: controller.signal, cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as PricingTable;
    if (data.currency !== 'RMB' || !Number.isInteger(data.version) || !Number.isInteger(data.updatedAt) || !Array.isArray(data.models)
      || !Number.isFinite(data.usdExchangeRate ?? 7) || (data.usdExchangeRate ?? 7) <= 0) throw new Error('Invalid pricing data');
    for (const model of data.models) {
      if (typeof model.modelId !== 'string' || costFields.some(field => !Number.isFinite(model[field]) || model[field] < 0)) throw new Error('Invalid model');
      for (const pattern of model.aliasPatterns ?? []) new RegExp(pattern, 'i');
    }
    table.value = data;
    if (!families.value.some(family => family.id === selectedFamily.value)) selectedFamily.value = '';
  } catch {
    if (request === controller) loadFailed.value = true;
  } finally {
    clearTimeout(timeout);
    if (request === controller) loading.value = false;
  }
  if (request === controller && !loadFailed.value) await followModelLink();
}
onMounted(() => {
  void loadData();
  timer = setInterval(() => { now.value = Math.floor(Date.now() / 1000); }, 15000);
  window.addEventListener('hashchange', followModelLink);
});
onUnmounted(() => { request?.abort(); clearInterval(timer); window.removeEventListener('hashchange', followModelLink); });
</script>

<template>
  <div id="top" aria-hidden="true"></div>
  <a class="skip-link" href="#pricing">{{ t('skip') }}</a>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="#top"><span class="brand-icon"><AppIcon name="table" /></span><span>{{ t('brand') }}</span></a>
      <div class="header-actions">
        <a class="source-link" :href="sourceUrl" target="_blank" rel="noopener noreferrer">GitHub <AppIcon name="external" /></a>
        <div class="segmented language-control" role="group" :aria-label="t('language')">
          <button type="button" :class="{ selected: language === 'zh' }" :aria-pressed="language === 'zh'" lang="zh-CN" @click="language = 'zh'">中文</button>
          <button type="button" :class="{ selected: language === 'en' }" :aria-pressed="language === 'en'" lang="en" @click="language = 'en'">EN</button>
        </div>
      </div>
    </div>
  </header>

  <main class="page-shell">
    <section class="intro" aria-labelledby="page-title">
      <div class="intro-copy"><p class="eyebrow"><span class="live-dot"></span>{{ t('eyebrow') }}</p><h1 id="page-title">{{ t('title') }}</h1><p class="intro-description">{{ t('introduction') }}</p></div>
      <div v-if="table" class="data-stamp"><span class="stamp-label">{{ t('updated') }}</span><time :datetime="new Date(table.updatedAt * 1000).toISOString()" :title="`${dateText(table.updatedAt, language)} · Asia/Shanghai`">{{ dateText(table.updatedAt, language, false) }}</time><span class="stamp-version">{{ t('version') }} <b>v{{ table.version }}</b></span></div>
    </section>

    <div class="facts-bar">
      <div class="fact"><b>{{ table?.models.length ?? '—' }}</b><span>{{ t('models') }}</span></div>
      <div class="fact"><b>{{ families.length || '—' }}</b><span>{{ t('families') }}</span></div>
      <div class="fact fact-unit"><span class="unit-symbol">{{ currency === 'RMB' ? '¥' : '$' }}</span><span><b>{{ currency }}</b> / {{ t('perMillion') }}</span></div>
      <div class="fact fact-timezone"><AppIcon name="clock" /><span>{{ t('china') }} <b>UTC+08:00</b></span></div>
    </div>

    <section v-if="loading || loadFailed" class="loading-panel" role="status" aria-live="polite">
      <span v-if="loading" class="loader"></span><AppIcon v-else name="info" />
      <h2>{{ loading ? t('loading') : t('loadError') }}</h2>
      <template v-if="loadFailed && !loading"><p>{{ t('loadErrorNote') }}</p><div class="error-actions"><button class="primary-button" @click="loadData">{{ t('retry') }}</button><a :href="dataUrl" download="model_pricing.json">{{ t('download') }}</a></div></template>
    </section>

    <div v-else-if="table" class="browse-layout">
      <aside class="family-sidebar" :aria-label="t('family')">
        <p class="sidebar-heading">{{ t('family') }}</p>
        <nav class="family-nav">
          <button type="button" :class="{ active: !selectedFamily }" :aria-pressed="!selectedFamily" @click="selectedFamily = ''"><span><span class="family-dot all-dot"></span>{{ t('all') }}</span><span class="family-count">{{ table.models.length }}</span></button>
          <button v-for="family in families" :key="family.id" type="button" :class="{ active: selectedFamily === family.id }" :aria-pressed="selectedFamily === family.id" @click="selectedFamily = family.id"><span><span class="family-dot" :data-family="family.id"></span>{{ family.label }}</span><span class="family-count">{{ family.count }}</span></button>
        </nav>
        <a class="sidebar-download" :href="dataUrl" download="model_pricing.json"><AppIcon name="download" />{{ t('download') }}</a>
      </aside>

      <section id="pricing" class="pricing-content" aria-labelledby="pricing-heading">
        <div class="toolbar">
          <div class="search-field"><AppIcon name="search" /><input v-model="query" type="search" :placeholder="t('searchPlaceholder')" :aria-label="t('search')" autocomplete="off" spellcheck="false" /><button v-if="query" type="button" :aria-label="t('clearSearch')" @click="query = ''"><AppIcon name="close" /></button></div>
          <div class="segmented currency-control" role="group" :aria-label="t('currency')"><button type="button" :class="{ selected: currency === 'RMB' }" :aria-pressed="currency === 'RMB'" @click="currency = 'RMB'">¥ RMB</button><button type="button" :class="{ selected: currency === 'USD' }" :aria-pressed="currency === 'USD'" @click="currency = 'USD'">$ USD</button></div>
          <div class="calculator-control"><button ref="calculatorToggle" type="button" :class="{ active: showCalculator }" :aria-expanded="calculatorExpanded" aria-controls="cost-calculator" @click="toggleCalculatorPanel"><AppIcon name="calculator" />{{ showCalculator ? t('editCalculator') : t('showCalculator') }}</button></div>
        </div>
        <CostCalculator v-show="calculatorExpanded" v-model="calculatorInputs" :expanded="calculatorExpanded" :language="language" :now="now" @minimize="minimizeCalculator" @disable="disableCalculator" />
        <button v-if="showCalculator && !calculatorExpanded" class="calculator-dock" type="button" aria-controls="cost-calculator" :aria-label="t('editCalculator')" @click="calculatorExpanded = true"><AppIcon name="calculator" /><span>{{ t('editCalculator') }}</span><b>{{ calculatorUsage ? t('calculatorActive') : t('calculatorInvalid') }}</b></button>
        <div class="results-bar"><p role="status" aria-live="polite">{{ resultsText }} <button v-if="query || selectedFamily" class="text-button" @click="reset">{{ t('reset') }}</button></p><label class="sort-control"><span>{{ t('sort') }}</span><select v-model="sort" :aria-label="t('sort')"><option v-for="option in sortOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label></div>
        <p v-if="exactMatch" class="match-note">{{ t('exactMatch') }} <code>{{ exactMatch.modelId }}</code></p>

        <div class="table-panel">
          <div class="table-heading"><div><h2 id="pricing-heading">{{ t('tableTitle') }}</h2><p>{{ showCalculator ? t('estimateTableNote') : t('tableNote') }}</p></div><div class="price-legend"><span><i></i>{{ t('offPeak') }}</span><span class="peak-legend"><i></i>{{ t('peak') }}</span></div></div>
          <table v-if="rows.length" class="pricing-table" :class="{ 'with-estimates': showCalculator }">
            <caption class="sr-only">{{ t('tableCaption') }} {{ currency }} / {{ t('perMillion') }}</caption>
            <thead><tr><th scope="col">{{ t('model') }}</th><th v-for="label in labels" :key="label" scope="col" class="numeric">{{ t(label) }}<small>{{ currency }} / 1M</small></th><th v-if="showCalculator" scope="col" class="numeric estimate-column" :aria-sort="sort === 'total' ? 'ascending' : sort === 'totalDesc' ? 'descending' : 'none'"><button type="button" class="estimate-sort" :title="sort === 'total' ? t('estimateDescending') : t('estimateOrder')" @click="toggleEstimateSort">{{ t('estimatedAmount') }}<span aria-hidden="true">{{ sort === 'total' ? '↑' : sort === 'totalDesc' ? '↓' : '↕' }}</span></button><small>{{ currency }} / {{ t('perUsage') }}</small></th></tr></thead>
            <tbody>
              <template v-for="row in rows" :key="row.model.modelId">
                <tr :id="`model-${row.model.modelId}`" class="model-row" :class="{ expanded: opened.has(row.model.modelId) }">
                  <th scope="row" class="model-cell"><button class="model-toggle" type="button" :aria-expanded="opened.has(row.model.modelId)" :aria-controls="`details-${row.model.modelId}`" :title="opened.has(row.model.modelId) ? t('closeDetails') : t('details')" @click="toggleModel(row.model.modelId)"><span class="model-name">{{ row.model.modelId }}</span><AppIcon name="chevron" /></button><div class="model-meta"><span class="family-tag" :data-family="row.model.family">{{ familyName(row.model) }}</span><span v-if="row.hasTiers" class="rule-tag">{{ t('tierBadge') }}</span><span v-if="row.model.timeRules?.length" class="rule-tag">{{ t('periodBadge') }}</span><span v-if="row.hasPeak && !row.node.dailySlots?.length" class="rule-tag peak-tag">{{ t('peak') }}</span></div></th>
                  <td v-for="(field, index) in costFields" :key="field" class="numeric price-cell" :data-label="t(labels[index]!)"><span class="base-price" :aria-label="`${t('offPeak')} ${priceText(row.node[field], currency, rate)}`">{{ priceText(row.node[field], currency, rate) }}</span><span v-if="row.node.dailySlots?.length" class="peak-price" :aria-label="`${t('peak')} ${peakText(row.node, field, currency, rate)}`"><i></i>{{ peakText(row.node, field, currency, rate) }}</span></td>
                  <td v-if="showCalculator" class="numeric price-cell estimate-cell" :data-label="`${t('estimatedAmount')} (${currency})`"><span class="base-price">{{ row.estimate ? priceText(row.estimate.total, currency, rate) : '—' }}</span><small>{{ t('perUsage') }}</small></td>
                </tr>
                <tr v-if="opened.has(row.model.modelId)" class="details-row"><td :id="`details-${row.model.modelId}`" :colspan="showCalculator ? 6 : 5"><CostBreakdown v-if="row.estimate && calculatorUsage" :estimate="row.estimate" :usage="calculatorUsage" :language="language" :currency="currency" :rate="rate" /><ModelDetails :model="row.model" :language="language" :currency="currency" :rate="rate" :now="now" /></td></tr>
              </template>
            </tbody>
          </table>
          <div v-else class="empty-state"><span class="empty-icon"><AppIcon name="search" /></span><h3>{{ t('noResults') }}</h3><p>{{ searchResult.ambiguous ? t('ambiguous') : t('noResultsNote') }}</p><button class="primary-button" @click="reset">{{ t('reset') }}</button></div>
          <div class="table-footnote"><AppIcon name="info" /><p>{{ t('zeroNote') }}</p></div>
        </div>
        <p class="exchange-note">{{ t('exchange') }}: <b>1 USD = {{ priceText(rate, 'RMB', rate) }} RMB</b><span>{{ t('exchangeNote') }}</span></p>
      </section>
    </div>

    <section class="reading-guide" aria-labelledby="guide-heading"><div class="guide-heading"><p class="eyebrow">{{ language === 'zh' ? '阅读指南' : 'A QUICK GUIDE' }}</p><h2 id="guide-heading">{{ t('guideTitle') }}</h2><p>{{ t('guideIntro') }}</p></div><div class="guide-grid"><article><span class="guide-number">01</span><h3>{{ t('guideContextTitle') }}</h3><p>{{ t('guideContext') }}</p></article><article><span class="guide-number">02</span><h3>{{ t('guideTimeTitle') }}</h3><p>{{ t('guideTime') }}</p></article><article><span class="guide-number">03</span><h3>{{ t('guidePeriodTitle') }}</h3><p>{{ t('guidePeriod') }}</p></article></div></section>
  </main>

  <footer class="site-footer"><div><a class="footer-brand" href="#top">{{ t('brand') }}</a><p>{{ t('footerNote') }}</p></div><nav><a :href="`${sourceUrl}/blob/master/${language === 'zh' ? 'README_zh.md' : 'README.md'}`" target="_blank" rel="noopener noreferrer">{{ t('specification') }}<AppIcon name="arrow" /></a><a :href="dataUrl" download="model_pricing.json">JSON<AppIcon name="download" /></a><a href="#top">{{ t('backTop') }}<AppIcon name="arrow" /></a></nav></footer>
</template>
