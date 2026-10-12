<script setup lang="ts">
import { computed } from 'vue';
import { contextNodes, costFields, minuteText, priceText } from '../lib/pricing.ts';
import type { Container, Currency, DailySlot, Language } from '../lib/pricing.ts';
import { messages, ruleLabel, text } from '../lib/i18n.ts';

const props = defineProps<{ container: Container; language: Language; currency: Currency; rate: number }>();
const t = (key: Parameters<typeof text>[1]) => text(props.language, key);
const fields = ['input', 'output', 'cacheRead', 'cacheCreation'] as const;
const nodes = computed(() => contextNodes(props.container));
const number = (value: number) => new Intl.NumberFormat('en-US').format(value);
function days(slot: DailySlot) {
  const values = [...(slot.daysOfWeek ?? [1, 2, 3, 4, 5, 6, 7])].sort();
  if (values.length === 7) return t('everyDay');
  if (values.join() === '1,2,3,4,5') return t('weekdays');
  if (values.join() === '6,7') return t('weekends');
  return values.map(day => messages[props.language].days[day - 1]).join(props.language === 'zh' ? '、' : ', ');
}
</script>

<template>
  <div class="rule-table-scroll" tabindex="0" :aria-label="t('tableTitle')">
    <table class="rule-table">
      <caption class="sr-only">{{ t('contextNote') }} {{ currency }} / {{ t('perMillion') }}</caption>
      <thead><tr><th scope="col">{{ t('context') }}</th><th scope="col">{{ t('schedule') }}</th><th v-for="field in fields" :key="field" scope="col" class="numeric">{{ t(field) }}</th></tr></thead>
      <tbody v-for="band in nodes" :key="band.minimum">
        <tr class="band-base">
          <th :rowspan="1 + (band.node.dailySlots?.length ?? 0)" scope="rowgroup" class="context-cell">
            <span>{{ number(band.minimum) }}<template v-if="band.maximum !== undefined"> ≤ C &lt; {{ number(band.maximum) }}</template><template v-else> ≤ C</template></span>
            <small>{{ t('tokens') }}</small>
          </th>
          <td><span class="schedule-label">{{ band.node.dailySlots?.length ? t('offPeak') : t('allDay') }}</span><small v-if="band.node.dailySlots?.length">{{ t('otherTimes') }}</small></td>
          <td v-for="field in costFields" :key="field" class="numeric">{{ priceText(band.node[field], currency, rate) }}</td>
        </tr>
        <tr v-for="(slot, index) in band.node.dailySlots ?? []" :key="index" class="band-peak">
          <td><span class="schedule-label peak-label">{{ ruleLabel(slot.label, language) }}</span><small>{{ days(slot) }} · {{ slot.windows.map(window => `${minuteText(window.startMinute)}–${minuteText(window.endMinute)}`).join(' / ') }}</small></td>
          <td v-for="field in costFields" :key="field" class="numeric">{{ priceText(slot[field], currency, rate) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
