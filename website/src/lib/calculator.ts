import { activeContainer, costFields, slotMatches } from './pricing.ts';
import type { Model } from './pricing.ts';

export const tokenFields = ['input', 'output', 'cacheRead', 'cacheCreation'] as const;
export type TokenField = typeof tokenFields[number];
export type TokenUsage = Record<TokenField, number>;
export type TokenInputs = Record<TokenField, string>;

// Comparison workloads, not pricing data. Coding ratios come from the supplied
// screenshots' four displayed counts; largest remainders make each total exactly 100M.
export const usagePresets = [
  { id: 'translation', tokens: { input: 100000000, output: 100000000, cacheRead: 0, cacheCreation: 0 } },
  // Image 1: 2.3M input / 597.7K output / 146.1M cache read / 0 cache creation.
  { id: 'codingLargeContext', tokens: { input: 1543648, output: 401147, cacheRead: 98055205, cacheCreation: 0 } },
  // Image 2: 18.8M input / 2.3M output / 344.9M cache read / 0 cache creation.
  { id: 'codingHigh', tokens: { input: 5136612, output: 628415, cacheRead: 94234973, cacheCreation: 0 } },
  // Image 3: 11.7M input / 565.2K output / 99.9M cache read / 0 cache creation.
  { id: 'codingLow', tokens: { input: 10431043, output: 503899, cacheRead: 89065058, cacheCreation: 0 } },
] as const;

export function tokenInputs(usage: TokenUsage): TokenInputs {
  return { input: formatTokenInput(String(usage.input)), output: formatTokenInput(String(usage.output)), cacheRead: formatTokenInput(String(usage.cacheRead)), cacheCreation: formatTokenInput(String(usage.cacheCreation)) };
}

export function formatTokenInput(value: string): string {
  const digits = value.trim().replaceAll(',', '');
  // Format strings directly so even unsafe integers remain exact and can be rejected.
  return /^\d+$/.test(digits) ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : value;
}

export function parseTokenCount(value: string): number | undefined {
  if (!/^(\d+|\d{1,3}(,\d{3})+)$/.test(value.trim())) return undefined;
  const count = Number(value.trim().replaceAll(',', ''));
  return Number.isSafeInteger(count) ? count : undefined;
}

function validUsage(usage: TokenUsage) {
  return tokenFields.every(field => Number.isSafeInteger(usage[field]) && usage[field] >= 0)
    && Number.isSafeInteger(tokenFields.reduce((sum, field) => sum + usage[field], 0));
}

export function parseTokenInputs(inputs: TokenInputs): TokenUsage | undefined {
  const usage = {} as TokenUsage;
  for (const field of tokenFields) {
    const count = parseTokenCount(inputs[field]);
    if (count === undefined) return undefined;
    usage[field] = count;
  }
  return validUsage(usage) ? usage : undefined;
}

export function estimateCost(model: Model, usage: TokenUsage, unixSeconds: number) {
  if (!validUsage(usage)) throw new RangeError('Token counts and their sum must be nonnegative safe integers');
  // Workloads can be cumulative; do not treat their total as one request's context.
  // Use only the active date container's base prices and its own daily schedule.
  const container = activeContainer(model, unixSeconds);
  const slot = (container.dailySlots ?? []).find(slot => slotMatches(slot, unixSeconds));
  const price = slot ?? container;
  const breakdown = {} as TokenUsage;
  tokenFields.forEach((field, index) => { breakdown[field] = usage[field] / 1_000_000 * price[costFields[index]!]; });
  const total = tokenFields.reduce((sum, field) => sum + breakdown[field], 0);
  const totalTokens = tokenFields.reduce((sum, field) => sum + usage[field], 0);
  return { container, slot, price, totalTokens, breakdown, total };
}

export type CostEstimate = ReturnType<typeof estimateCost>;
