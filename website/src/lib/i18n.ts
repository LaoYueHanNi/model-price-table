import type { Language } from './pricing.ts';

const zh = {
  brand: '模型定价表', skip: '跳转到价格表', repository: '源码', download: '下载 JSON',
  eyebrow: '开放数据 · 清晰定价', title: '模型定价，一目了然。',
  introduction: '输入、输出与缓存费用，以及影响价格的完整规则。',
  models: '个模型', families: '个家族', updated: '数据更新', version: '数据版本',
  china: '中国标准时间', perMillion: '每百万 tokens', family: '模型家族', all: '所有模型',
  search: '搜索模型或 API 名称', searchPlaceholder: '搜索模型名称，例如 Claude、GPT、DeepSeek…',
  clearSearch: '清空搜索', results: '显示 {count} / {total} 个模型', reset: '重置筛选',
  sort: '排序', sourceOrder: '数据顺序', nameOrder: '模型名称', inputOrder: '输入价格从低到高',
  outputOrder: '输出价格从低到高', readOrder: '缓存读取从低到高', creationOrder: '缓存创建从低到高',
  model: '模型', input: '输入', output: '输出', cacheRead: '缓存读取', cacheCreation: '缓存创建',
  offPeak: '非峰时', peak: '峰时', tierBadge: '阶梯价', periodBadge: '时间规则',
  tableTitle: '价格总览', tableNote: '显示当前适用时期的最低上下文档位。峰时价格单独列出；其他档位及历史价格请展开查看。',
  tableCaption: '模型价格表，价格单位为每百万 tokens。点击模型名称查看完整规则。',
  unit: '单位', exchange: '汇率', exchangeNote: '美元价格由人民币价格按表内汇率换算，非实时汇率。',
  details: '查看完整规则', closeDetails: '收起规则', currentRules: '当前适用价格',
  basePeriod: '默认定价', outsidePeriods: '不在以下任何时间区间内时适用',
  context: '上下文范围', schedule: '适用时段', allDay: '全天', otherTimes: '其他时间',
  everyDay: '每天', weekdays: '周一至周五', weekends: '周六、周日',
  days: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  tokens: 'tokens', contextNote: '上下文 = 输入 tokens + 缓存读取 tokens；下限包含，上限不包含。',
  slotsNote: '所有星期与每日时段均按 Asia/Shanghai（UTC+08:00）；时段包含开始、不包含结束。每个档位只使用自身的峰时规则。',
  periods: '全部价格时期', current: '当前适用', past: '已结束', future: '尚未开始',
  fromBeginning: '自记录起', through: '至', periodNote: '绝对时间区间包含起止时刻。命中时间规则后，使用该时期自己的上下文和峰时规则。',
  apiNames: 'API 名称与匹配规则', aliases: '兼容的历史名称', patterns: '完整名称匹配规则',
  aliasNote: '模型 ID、历史名称、名称规则按此顺序匹配，均忽略 ASCII 字母大小写。Fast、Pro、Mini 等变体保持独立。',
  noAliases: '此模型没有额外的名称规则。', directLink: '此模型链接', exactMatch: 'API 名称对应',
  noResults: '没有找到匹配的模型', noResultsNote: '尝试其他关键词或选择“所有模型”。未知名称不会被推测为其他模型。',
  ambiguous: '该名称匹配到多个模型，请使用完整的模型 ID。',
  loading: '正在读取定价数据…', loadError: '暂时无法读取定价数据',
  loadErrorNote: '请重试，或直接下载原始 JSON 查看。', retry: '重新加载',
  guideTitle: '如何阅读这张表', guideIntro: '同一个模型可能有多个价格条件。展开模型后，可以看到每一档价格及其适用范围。',
  guideContextTitle: '先看上下文', guideContext: '上下文大小包含输入和缓存读取，不包含输出。达到阈值后，使用对应档位的价格。',
  guideTimeTitle: '再看时段', guideTime: '峰时价格仅在列出的星期和时段生效，其余时间使用该档位的非峰时价格。',
  guidePeriodTitle: '保留价格历史', guidePeriod: '有日期规则时，先确定价格时期，再确定上下文档位，最后确定峰时或非峰时价格。',
  zeroNote: '数值 0 表示定价数据中的零价格；不代表该模型一定支持对应的缓存功能。',
  footerNote: '价格直接来自本项目定价表。具体计费以服务方实际规则为准。',
  specification: '数据规范', backTop: '回到顶部', language: '语言', currency: '显示货币',
  other: '其他', doubao: '豆包', tencent: '腾讯', unassigned: '未分类',
};

const en: { [K in keyof typeof zh]: typeof zh[K] } = {
  brand: 'Model Price Table', skip: 'Skip to pricing', repository: 'Source', download: 'Download JSON',
  eyebrow: 'OPEN DATA · TRANSPARENT PRICING', title: 'Model pricing, at a glance.',
  introduction: 'Input, output and cache costs. Every rule that shapes the price.',
  models: 'models', families: 'families', updated: 'Data updated', version: 'Data version',
  china: 'China Standard Time', perMillion: 'per million tokens', family: 'Model families', all: 'All models',
  search: 'Search models or API names', searchPlaceholder: 'Search a model, e.g. Claude, GPT, DeepSeek…',
  clearSearch: 'Clear search', results: '{count} of {total} models', reset: 'Reset filters',
  sort: 'Sort by', sourceOrder: 'Data order', nameOrder: 'Model name', inputOrder: 'Input price: low to high',
  outputOrder: 'Output price: low to high', readOrder: 'Cache read: low to high', creationOrder: 'Cache creation: low to high',
  model: 'Model', input: 'Input', output: 'Output', cacheRead: 'Cache read', cacheCreation: 'Cache creation',
  offPeak: 'Off-peak', peak: 'Peak', tierBadge: 'Context tiers', periodBadge: 'Time rules',
  tableTitle: 'Pricing overview', tableNote: 'The lowest context band in the currently applicable price period. Peak rates appear separately; expand a model for all bands and past prices.',
  tableCaption: 'Model prices per million tokens. Select a model name to view its complete rules.',
  unit: 'Unit', exchange: 'Exchange rate', exchangeNote: 'USD prices are converted from RMB using the table’s exchange rate, not a live rate.',
  details: 'View all pricing rules', closeDetails: 'Collapse pricing rules', currentRules: 'Currently applicable prices',
  basePeriod: 'Default pricing', outsidePeriods: 'Applies outside all time ranges listed below',
  context: 'Context range', schedule: 'Schedule', allDay: 'All day', otherTimes: 'Other times',
  everyDay: 'Every day', weekdays: 'Mon–Fri', weekends: 'Sat–Sun',
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  tokens: 'tokens', contextNote: 'Context = input tokens + cache-read tokens. Lower bounds are inclusive; upper bounds are exclusive.',
  slotsNote: 'Weekdays and daily windows use Asia/Shanghai (UTC+08:00). Start times are inclusive; end times are exclusive. Each context band uses only its own peak rules.',
  periods: 'All price periods', current: 'Active now', past: 'Ended', future: 'Upcoming',
  fromBeginning: 'From the start of records', through: 'to', periodNote: 'Absolute time ranges include both endpoints. A matching period supplies its own context tiers and peak rules.',
  apiNames: 'API names & matching rules', aliases: 'Historical compatible names', patterns: 'Full-name matching patterns',
  aliasNote: 'Model IDs, historical names, then patterns are matched in that order, ignoring ASCII letter case. Fast, Pro, Mini and other variants remain distinct.',
  noAliases: 'This model has no additional name rules.', directLink: 'Link to this model', exactMatch: 'API name resolves to',
  noResults: 'No matching models', noResultsNote: 'Try another keyword or select “All models”. Unknown names are never inferred to be another model.',
  ambiguous: 'This name matches multiple models. Please use a full model ID.',
  loading: 'Loading pricing data…', loadError: 'Pricing data is unavailable',
  loadErrorNote: 'Try again, or download the source JSON to view it directly.', retry: 'Try again',
  guideTitle: 'Reading the pricing table', guideIntro: 'A model may have several price conditions. Expand it to see each price and exactly when it applies.',
  guideContextTitle: 'Start with context', guideContext: 'Context includes input and cache-read tokens, not output. At a threshold, the matching context band supplies the prices.',
  guideTimeTitle: 'Check the schedule', guideTime: 'Peak prices apply only on the listed days and daily windows. All other times use that band’s off-peak prices.',
  guidePeriodTitle: 'Keep the full history', guidePeriod: 'Resolve the date period first, then its context band, then its peak or off-peak price.',
  zeroNote: 'A zero is a zero price recorded in the data. It does not guarantee support for that cache feature.',
  footerNote: 'Prices come directly from this repository’s table. Actual billing follows the service provider’s rules.',
  specification: 'Data specification', backTop: 'Back to top', language: 'Language', currency: 'Display currency',
  other: 'Other', doubao: 'Doubao', tencent: 'Tencent', unassigned: 'Unassigned',
};

export const messages = { zh, en };
export type MessageKey = Exclude<keyof typeof zh, 'days'>;
export function text(language: Language, key: MessageKey) { return messages[language][key]; }

const labels: Record<string, string> = {
  '第一次长期降价': 'First long-term price reduction', '每日峰谷期': 'Daily peak / off-peak pricing',
  '免费预览期': 'Free preview period', '限时5折': 'Limited-time 50% discount',
  '限时优惠价': 'Limited-time pricing', '原价': 'Original pricing',
  '工作日高峰时段': 'Weekday peak hours', '每日高峰时段': 'Daily peak hours',
};
export function ruleLabel(label: string, language: Language) {
  if (language === 'zh') return label;
  if (labels[label]) return labels[label];
  if (/^\d{4}-\d{2}-\d{2} 缓存降价前$/.test(label)) return `Before cache price reduction (${label.slice(0, 10)})`;
  if (/^\d{4}-\d{2}-\d{2} 调价前$/.test(label)) return `Before price change (${label.slice(0, 10)})`;
  return label;
}
export function familyLabel(id: string, label: string | undefined, language: Language) {
  if (id === 'other' || id === 'doubao' || id === 'tencent' || id === 'unassigned') return text(language, id);
  return label || id;
}
