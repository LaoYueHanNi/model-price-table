<script setup lang="ts">
import { costFields, priceText } from '../lib/pricing.ts';
import type { Currency, Language, TimeRule } from '../lib/pricing.ts';
import { tokenFields } from '../lib/calculator.ts';
import type { CostEstimate, TokenUsage } from '../lib/calculator.ts';
import { ruleLabel, text } from '../lib/i18n.ts';

defineProps<{ estimate: CostEstimate; usage: TokenUsage; language: Language; currency: Currency; rate: number }>();
const number = (value: number) => new Intl.NumberFormat('en-US').format(value);
</script>

<template>
  <section class="cost-breakdown" :aria-label="text(language, 'costBreakdown')">
    <div class="detail-heading"><h3>{{ text(language, 'costBreakdown') }}</h3><strong class="estimate-total">{{ currency === 'RMB' ? '¥' : '$' }} {{ priceText(estimate.total, currency, rate) }}</strong></div>
    <p class="estimate-rule">{{ text(language, 'appliedRules') }}: {{ 'label' in estimate.container ? ruleLabel((estimate.container as TimeRule).label, language) : text(language, 'basePeriod') }} · {{ text(language, 'baseRate') }} · {{ estimate.slot ? `${text(language, 'peak')} (${ruleLabel(estimate.slot.label, language)})` : estimate.container.dailySlots?.length ? text(language, 'offPeak') : text(language, 'allDay') }}</p>
    <div class="rule-table-scroll" tabindex="0" :aria-label="text(language, 'costBreakdown')">
      <table class="breakdown-table">
        <caption class="sr-only">{{ text(language, 'costFormula') }} {{ currency }}</caption>
        <thead><tr><th scope="col">{{ text(language, 'costItem') }}</th><th scope="col" class="numeric">tokens</th><th scope="col" class="numeric">{{ text(language, 'appliedRate') }}<small>{{ currency }} / 1M</small></th><th scope="col" class="numeric">{{ text(language, 'subtotal') }}<small>{{ currency }}</small></th></tr></thead>
        <tbody><tr v-for="(field, index) in tokenFields" :key="field"><th scope="row">{{ text(language, field) }}</th><td class="numeric">{{ number(usage[field]) }}</td><td class="numeric">{{ priceText(estimate.price[costFields[index]!], currency, rate) }}</td><td class="numeric">{{ priceText(estimate.breakdown[field], currency, rate) }}</td></tr></tbody>
      </table>
    </div>
    <p class="detail-note">{{ text(language, 'costFormula') }}</p>
  </section>
</template>
