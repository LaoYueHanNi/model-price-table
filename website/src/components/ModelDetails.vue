<script setup lang="ts">
import { computed } from 'vue';
import RuleTable from './RuleTable.vue';
import AppIcon from './AppIcon.vue';
import { activeContainer, dateText } from '../lib/pricing.ts';
import type { Currency, Language, Model, TimeRule } from '../lib/pricing.ts';
import { ruleLabel, text } from '../lib/i18n.ts';

const props = defineProps<{ model: Model; language: Language; currency: Currency; rate: number; now: number }>();
const t = (key: Parameters<typeof text>[1]) => text(props.language, key);
const current = computed(() => activeContainer(props.model, props.now));
const periods = computed(() => [...(props.model.timeRules ?? [])].sort((a, b) => b.startTime - a.startTime));
const periodRange = (rule: TimeRule) => `${rule.startTime === 0 ? t('fromBeginning') : dateText(rule.startTime, props.language)} ${t('through')} ${dateText(rule.endTime, props.language)}`;
</script>

<template>
  <div class="model-details">
    <div class="detail-heading"><h3>{{ t('currentRules') }}</h3><span class="detail-unit">{{ currency }} / {{ t('perMillion') }}</span></div>
    <p v-if="current !== model" class="period-summary">{{ ruleLabel((current as TimeRule).label, language) }} · {{ periodRange(current as TimeRule) }}</p>
    <RuleTable :container="current" :language="language" :currency="currency" :rate="rate" />
    <p class="detail-note">{{ t('contextNote') }}</p>
    <p class="detail-note">{{ t('slotsNote') }}</p>

    <details v-if="periods.length" class="sub-details">
      <summary>{{ t('periods') }} <span class="count-pill">{{ periods.length + 1 }}</span></summary>
      <div class="period-block">
        <h4>{{ t('basePeriod') }} <span v-if="current === model" class="status-badge">{{ t('current') }}</span></h4>
        <p>{{ t('outsidePeriods') }}</p>
        <RuleTable :container="model" :language="language" :currency="currency" :rate="rate" />
      </div>
      <div v-for="(period, index) in periods" :key="index" class="period-block">
        <h4>{{ ruleLabel(period.label, language) }} <span class="status-badge" :class="{ 'status-muted': current !== period }">{{ current === period ? t('current') : period.endTime < now ? t('past') : t('future') }}</span></h4>
        <p>{{ periodRange(period) }} · UTC+08:00</p>
        <RuleTable :container="period" :language="language" :currency="currency" :rate="rate" />
      </div>
      <p class="detail-note">{{ t('periodNote') }}</p>
    </details>

    <details class="sub-details">
      <summary>{{ t('apiNames') }}</summary>
      <p class="detail-note">{{ t('aliasNote') }}</p>
      <div v-if="model.aliases?.length" class="name-section"><h4>{{ t('aliases') }}</h4><div class="alias-list"><code v-for="alias in model.aliases" :key="alias">{{ alias }}</code></div></div>
      <div v-if="model.aliasPatterns?.length" class="name-section"><h4>{{ t('patterns') }}</h4><div class="pattern-list"><code v-for="pattern in model.aliasPatterns" :key="pattern">{{ pattern }}</code></div></div>
      <p v-if="!model.aliases?.length && !model.aliasPatterns?.length" class="detail-note">{{ t('noAliases') }}</p>
    </details>
    <a class="model-permalink" :href="`?lang=${language}&currency=${currency}#model=${encodeURIComponent(model.modelId)}`"><AppIcon name="arrow" />{{ t('directLink') }}</a>
  </div>
</template>
