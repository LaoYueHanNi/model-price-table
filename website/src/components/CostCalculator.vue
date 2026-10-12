<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import { formatTokenInput, parseTokenCount, parseTokenInputs, tokenFields, tokenInputs, usagePresets } from '../lib/calculator.ts';
import type { TokenField, TokenInputs } from '../lib/calculator.ts';
import { dateText } from '../lib/pricing.ts';
import type { Language } from '../lib/pricing.ts';
import { text } from '../lib/i18n.ts';

const props = defineProps<{ expanded: boolean; language: Language; now: number }>();
const emit = defineEmits<{ minimize: []; disable: [] }>();
const panel = ref<HTMLElement>();
const inputs = defineModel<TokenInputs>({ required: true });
const t = (key: Parameters<typeof text>[1]) => text(props.language, key);
const usage = computed(() => parseTokenInputs(inputs.value));
const totalTokens = computed(() => {
  const current = usage.value;
  return current ? tokenFields.reduce((sum, field) => sum + current[field], 0) : undefined;
});
const number = (value: number) => new Intl.NumberFormat('en-US').format(value);
const activePreset = computed(() => usagePresets.find(preset => tokenFields.every(field => usage.value?.[field] === preset.tokens[field]))?.id);
const presetLabel = { translation: 'translationPreset', codingLargeContext: 'codingLargeContextPreset', codingHigh: 'codingHighPreset', codingLow: 'codingLowPreset' } as const;
const codingPresets = usagePresets.filter(preset => preset.id !== 'translation');
const activeCoding = computed(() => codingPresets.find(preset => preset.id === activePreset.value));
const codingDialog = ref<HTMLDialogElement>();
const codingTrigger = ref<HTMLButtonElement>();
const codingOpen = ref(false);
watch(() => props.expanded, async expanded => {
  if (expanded) {
    await nextTick();
    panel.value?.focus({ preventScroll: true });
  } else codingDialog.value?.close();
});
function updateInput(field: TokenField, event: Event) {
  if ((event as InputEvent).isComposing) return;
  const input = event.target as HTMLInputElement;
  const raw = input.value;
  const formatted = formatTokenInput(raw);
  const start = input.selectionStart ?? raw.length;
  const end = input.selectionEnd ?? start;
  const caret = (offset: number) => {
    const characters = raw.slice(0, offset).replaceAll(',', '').length;
    let position = 0;
    let counted = 0;
    while (position < formatted.length && counted < characters) {
      if (formatted[position] !== ',') counted++;
      position++;
    }
    return position;
  };
  inputs.value = { ...inputs.value, [field]: formatted };
  if (formatted !== raw) {
    input.value = formatted;
    input.setSelectionRange(caret(start), caret(end));
  }
}
function skipSeparator(event: KeyboardEvent) {
  const input = event.target as HTMLInputElement;
  const position = input.selectionStart;
  if (position === null || position !== input.selectionEnd || event.ctrlKey || event.metaKey || event.altKey) return;
  // Delete a digit beside a generated comma, rather than immediately reinserting it.
  if (event.key === 'Backspace' && input.value[position - 1] === ',') input.setSelectionRange(position - 1, position - 1);
  if (event.key === 'Delete' && input.value[position] === ',') input.setSelectionRange(position + 1, position + 1);
}
function minimizeOnEscape() {
  if (!codingOpen.value) emit('minimize');
}
function compactTokens(value: number) {
  if (value >= 1000000) return `${Math.floor(value / 10000) / 100}M`;
  if (value >= 1000) return `${Math.floor(value / 100) / 10}K`;
  return String(value);
}
function presetName(preset: typeof codingPresets[number]) {
  const inputTotal = preset.tokens.input + preset.tokens.cacheRead + preset.tokens.cacheCreation;
  const hitRate = preset.tokens.cacheRead / inputTotal * 100;
  return t(presetLabel[preset.id]).replace('{hitRate}', hitRate.toFixed(1));
}
function openCoding() {
  codingTrigger.value?.focus();
  codingDialog.value?.showModal();
  codingOpen.value = true;
}
function selectCoding(preset: typeof codingPresets[number]) {
  inputs.value = tokenInputs(preset.tokens);
  codingDialog.value?.close();
}
function closeBackdrop(event: MouseEvent) {
  if (event.target !== codingDialog.value) return;
  const bounds = codingDialog.value.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) codingDialog.value.close();
}
</script>

<template>
  <section id="cost-calculator" ref="panel" class="calculator-panel" tabindex="-1" aria-labelledby="calculator-heading" @keydown.esc="minimizeOnEscape">
    <div class="calculator-heading"><div><h2 id="calculator-heading"><AppIcon name="calculator" />{{ t('calculatorTitle') }}</h2><p>{{ t('baseRate') }}</p></div><button class="dialog-close" type="button" :aria-label="t('minimizeCalculator')" :title="t('minimizeCalculator')" @click="emit('minimize')"><span aria-hidden="true">−</span></button></div>
    <div class="usage-presets" role="group" :aria-label="t('exampleCases')">
      <button type="button" :class="{ selected: activePreset === 'translation' }" :aria-pressed="activePreset === 'translation'" @click="inputs = tokenInputs(usagePresets[0].tokens)">
        <span>{{ t('translationPreset') }}</span><small>{{ t('translationDescription') }}</small>
      </button>
      <button ref="codingTrigger" type="button" :class="{ selected: !!activeCoding }" :aria-pressed="!!activeCoding" :aria-expanded="codingOpen" aria-controls="coding-presets" aria-haspopup="dialog" @click="openCoding">
        <span class="coding-scenario-label">{{ t('codingScenario') }}<AppIcon name="chevron" /></span><small>{{ activeCoding ? presetName(activeCoding) : t('codingDescription') }}</small>
      </button>
    </div>
    <dialog id="coding-presets" ref="codingDialog" class="coding-dialog" aria-labelledby="coding-dialog-heading" aria-describedby="coding-dialog-note" @close="codingOpen = false" @click="closeBackdrop">
      <div class="coding-dialog-heading"><h3 id="coding-dialog-heading">{{ t('codingOptions') }}</h3><button class="dialog-close" type="button" :aria-label="t('closeCases')" @click="codingDialog?.close()"><AppIcon name="close" /></button></div>
      <p id="coding-dialog-note">{{ t('codingOptionsNote') }}</p>
      <div class="coding-options">
        <button v-for="preset in codingPresets" :key="preset.id" type="button" :class="{ selected: activePreset === preset.id }" :aria-pressed="activePreset === preset.id" @click="selectCoding(preset)">
          <span>{{ presetName(preset) }}</span>
          <small v-for="field in tokenFields" :key="field">{{ t(field) }} <b :title="number(preset.tokens[field])" :aria-label="number(preset.tokens[field])">{{ compactTokens(preset.tokens[field]) }}</b></small>
        </button>
      </div>
    </dialog>
    <div class="token-inputs">
      <label v-for="field in tokenFields" :key="field" :for="`tokens-${field}`">
        <span>{{ t(field) }} <small>tokens</small></span>
        <input :id="`tokens-${field}`" :value="inputs[field]" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" :aria-invalid="parseTokenCount(inputs[field]) === undefined" :aria-describedby="usage ? 'token-count-note' : 'token-count-note token-count-error'" @input="updateInput(field, $event)" @compositionend="updateInput(field, $event)" @keydown="skipSeparator" />
      </label>
    </div>
    <p v-if="!usage" id="token-count-error" class="calculator-error" role="status">{{ t('invalidTokenCount') }}</p>
    <div class="calculator-summary">
      <p>{{ t('estimatedTokens') }} <b>{{ totalTokens !== undefined ? number(totalTokens) : '—' }}</b> tokens</p>
    </div>
    <details class="calculator-help"><summary>{{ t('calculatorHelp') }}</summary><p id="token-count-note" class="calculator-note">{{ t('tokenCountNote') }}</p><p class="calculator-note">{{ t('baseEstimateNote') }}</p><p class="calculator-note">{{ t('presetNote') }}</p><p class="calculator-note">{{ t('estimateTime') }} <time :datetime="new Date(now * 1000).toISOString()">{{ dateText(now, language) }}</time> UTC+08:00</p></details>
    <div class="calculator-footer"><button class="calculator-disable" type="button" @click="emit('disable')">{{ t('hideCalculator') }}</button><button class="calculator-done" type="button" @click="emit('minimize')">{{ t('doneCalculator') }}</button></div>
  </section>
</template>
