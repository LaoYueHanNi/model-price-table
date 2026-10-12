export type Language = 'zh' | 'en';
export type Currency = 'RMB' | 'USD';
export const costFields = ['inputCostPerMillion', 'outputCostPerMillion', 'cacheReadCostPerMillion', 'cacheCreationCostPerMillion'] as const;
export type CostField = typeof costFields[number];
export type Costs = Record<CostField, number>;
export type DailySlot = Costs & { label: string; windows: { startMinute: number; endMinute: number }[]; daysOfWeek?: number[] };
export type PricingNode = Costs & { dailySlots?: DailySlot[] };
export type ContextTier = PricingNode & { threshold: number };
export type Container = PricingNode & { contextTiers?: ContextTier[] };
export type TimeRule = Container & { label: string; startTime: number; endTime: number };
export type Model = Container & { modelId: string; family?: string; timeRules?: TimeRule[]; aliases?: string[]; aliasPatterns?: string[] };
export type PricingTable = { version: number; updatedAt: number; currency: 'RMB'; usdExchangeRate?: number; families?: { id: string; label?: string }[]; models: Model[] };
export const TIME_ZONE = 'Asia/Shanghai';

export function activeContainer(model: Model, unixSeconds: number): Container {
  return (model.timeRules ?? []).find(rule => rule.startTime <= unixSeconds && unixSeconds <= rule.endTime) ?? model;
}

export function contextNodes(container: Container) {
  const tiers = [...(container.contextTiers ?? [])].sort((a, b) => a.threshold - b.threshold);
  const nodes: { minimum: number; maximum?: number; node: PricingNode }[] = [];
  if (!tiers.length || tiers[0].threshold > 0) nodes.push({ minimum: 0, maximum: tiers[0]?.threshold, node: container });
  tiers.forEach((tier, index) => nodes.push({ minimum: tier.threshold, maximum: tiers[index + 1]?.threshold, node: tier }));
  return nodes;
}

const clockFormatter = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
const isoWeekdays: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
export function chinaClock(unixSeconds: number) {
  const parts = Object.fromEntries(clockFormatter.formatToParts(new Date(unixSeconds * 1000)).map(part => [part.type, part.value]));
  return { minute: Number(parts.hour) * 60 + Number(parts.minute), weekday: isoWeekdays[parts.weekday!]! };
}

export function slotMatches(slot: DailySlot, unixSeconds: number) {
  const { minute, weekday } = chinaClock(unixSeconds);
  return (slot.daysOfWeek ?? [1, 2, 3, 4, 5, 6, 7]).includes(weekday)
    && slot.windows.some(window => window.startMinute <= minute && minute < window.endMinute);
}

export function resolvePrice(model: Model, unixSeconds: number, contextSize: number): PricingNode {
  const container = activeContainer(model, unixSeconds);
  const selected = contextNodes(container).filter(node => node.minimum <= contextSize).at(-1)!.node;
  return (selected.dailySlots ?? []).find(slot => slotMatches(slot, unixSeconds)) ?? selected;
}

export function foldAscii(value: string) {
  return value.replace(/[A-Z]/g, letter => letter.toLowerCase());
}

export function patternMatches(pattern: string, name: string) {
  const match = new RegExp(pattern, 'i').exec(name);
  return match?.index === 0 && match[0].length === name.length;
}

export function resolveModel(models: Model[], name: string): Model | undefined {
  const folded = foldAscii(name);
  const stages = [
    (model: Model) => foldAscii(model.modelId) === folded,
    (model: Model) => (model.aliases ?? []).some(alias => foldAscii(alias) === folded),
    (model: Model) => (model.aliasPatterns ?? []).some(pattern => patternMatches(pattern, name)),
  ];
  for (const stage of stages) {
    const hits = models.filter(stage);
    if (hits.length > 1) throw new Error('Ambiguous model name');
    if (hits.length === 1) return hits[0];
  }
}

export function searchModels(models: Model[], query: string) {
  if (!query) return models;
  const exact = resolveModel(models, query);
  if (exact) return [exact];
  const needle = foldAscii(query);
  return models.filter(model => [model.modelId, ...(model.aliases ?? [])].some(name => foldAscii(name).includes(needle)));
}

export function priceText(value: number, currency: Currency, rate: number) {
  const price = currency === 'USD' ? value / rate : value;
  if (price === 0) return '0';
  // Preserve small nonzero amounts: formatting must never turn a paid rate into zero.
  return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 8 }).format(price);
}

export function peakText(node: PricingNode, field: CostField, currency: Currency, rate: number) {
  const values = (node.dailySlots ?? []).map(slot => slot[field]);
  if (!values.length) return undefined;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return minimum === maximum ? priceText(minimum, currency, rate) : `${priceText(minimum, currency, rate)}–${priceText(maximum, currency, rate)}`;
}

export function minuteText(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function dateText(seconds: number, language: Language, withTime = true) {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' as const } : {}),
  }).format(new Date(seconds * 1000));
}
