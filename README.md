English | [简体中文](README_zh.md)

# model_pricing.json Specification

LLM model pricing table [`model_pricing.json`](./model_pricing.json).

Currency: **RMB**; unit price: **per million tokens**.

## Top-Level Structure

```json
{
  "version": 48,
  "updatedAt": 1785460200,
  "currency": "RMB",
  "usdExchangeRate": 7,
  "families": [{ "id": "gpt", "label": "GPT" }],
  "models": [ /* ... */ ]
}
```

| Field | Description |
|------|------|
| `version` | Version number; bump it after every rule change and update `updatedAt` accordingly |
| `updatedAt` | Unix seconds |
| `currency` | Always `RMB` |
| `usdExchangeRate` | USD exchange rate (RMB per 1 USD); used to derive USD-denominated prices. Default `7` |
| `families` | Optional; model-family filter list |
| `models` | Array of model pricing entries |

### USD-Denominated Pricing

All unit prices are in RMB per million tokens. `usdExchangeRate` is the USD exchange rate (RMB per 1 USD) used to express the same prices in US dollars:

```
usd_price = rmb_price / usdExchangeRate
```

It defaults to `7`; update the value yourself whenever the rate changes. The conversion applies identically to all four cost dimensions (input, output, cache read, cache creation).

## Model Node

Required: `modelId` + the four-dimension unit price.

Recommended to always include (empty array / empty string when absent):

- `contextTiers`, `timeRules`, `dailySlots`, `aliases`, `family`

```json
{
  "modelId": "example-model",
  "inputCostPerMillion": 14.0,
  "outputCostPerMillion": 84.0,
  "cacheReadCostPerMillion": 1.4,
  "cacheCreationCostPerMillion": 17.5,
  "dailySlots": [],
  "contextTiers": [],
  "timeRules": [],
  "aliases": [],
  "family": "gpt"
}
```

**Defaults**: omitted `dailySlots` / `contextTiers` / `timeRules` are treated as `[]`.

## Three-Layer Pricing (Mutually Exclusive Hit, Single Price)

```
1. Container: match timeRules (absolute dates) → otherwise the model root
2. Node: within the container, resolveTier(contextTiers) → otherwise the container root price
3. Peak/off-peak: on the chosen node, match dailySlots → otherwise the node's off-peak price
```

- A node's own four-dimension unit price is its **off-peak / other-time** price
- `dailySlots` is the node's peak-time override and **must not** nest `contextTiers`
- Once a tier matches, only that tier's `dailySlots` apply; the root's peak price is not borrowed

## Time Ranges `timeRules[]`

| Field | Description |
|------|------|
| `label` | Display name |
| `startTime` / `endTime` | Unix seconds, closed interval |
| Four-dimension unit price | Root off-peak price of this rule |
| `dailySlots` | Optional; rule-root peak/off-peak |
| `contextTiers` | Optional; context tiers inside the rule (each tier may also carry `dailySlots`) |

Date ranges of multiple `timeRules` within the same model **must not overlap**.

## Context Tiers `contextTiers[]`

| Field | Description |
|------|------|
| `threshold` | Context boundary (tokens); `contextSize = input + cacheRead` |
| Four-dimension unit price | Off-peak price of this tier |
| `dailySlots` | Optional; this tier's peak/off-peak |

Selection rule: the largest tier with `threshold <= contextSize`.

## Peak/Off-Peak Slots `dailySlots[]`

Attached to: **model root** / **any contextTier** / **any timeRule root**.

```json
{
  "label": "Peak",
  "windows": [
    { "startMinute": 480, "endMinute": 720 },
    { "startMinute": 840, "endMinute": 1080 }
  ],
  "daysOfWeek": [1, 2, 3, 4, 5],
  "inputCostPerMillion": 20.0,
  "outputCostPerMillion": 120.0,
  "cacheReadCostPerMillion": 2.0,
  "cacheCreationCostPerMillion": 25.0
}
```

| Field | Description |
|------|------|
| `windows[].startMinute` / `endMinute` | Minute of day `0..1440`, half-open interval `[start, end)` |
| `daysOfWeek` | Optional; ISO weekdays `1`=Monday … `7`=Sunday this slot applies to; omit = every day |
| Four-dimension unit price | Peak-time price |

Constraints:

- `windows` of slots whose `daysOfWeek` intersect within the same pricing node **must not overlap**
- A single window may not cross midnight (split it in two, e.g. `22:00-24:00` + `00:00-02:00`)
- A slot without `daysOfWeek` applies to every day; the weekday uses the same clock as `windows`
- Empty array = all-day off-peak for that node

Minute conversion: `08:00 → 480`, `12:00 → 720`, `14:00 → 840`, `18:00 → 1080`.

## Full Example (Time + Context + Peak/Off-Peak)

A condensed example:

```json
{
  "modelId": "gpt-5.6-terra",
  "inputCostPerMillion": 14.0,
  "outputCostPerMillion": 84.0,
  "cacheReadCostPerMillion": 1.4,
  "cacheCreationCostPerMillion": 17.5,
  "dailySlots": [{ "label": "模型根-峰时", "windows": [{ "startMinute": 480, "endMinute": 720 }], "daysOfWeek": [1, 2, 3, 4, 5], "inputCostPerMillion": 16.0, "outputCostPerMillion": 96.0, "cacheReadCostPerMillion": 1.6, "cacheCreationCostPerMillion": 20.0 }],
  "contextTiers": [{
    "threshold": 128000,
    "inputCostPerMillion": 28.0,
    "outputCostPerMillion": 168.0,
    "cacheReadCostPerMillion": 2.8,
    "cacheCreationCostPerMillion": 35.0,
    "dailySlots": [{ "label": "模型128K-峰时", "windows": [{ "startMinute": 480, "endMinute": 720 }], "inputCostPerMillion": 32.0, "outputCostPerMillion": 192.0, "cacheReadCostPerMillion": 3.2, "cacheCreationCostPerMillion": 40.0 }]
  }],
  "timeRules": [{
    "label": "原价",
    "startTime": 0,
    "endTime": 1769875199,
    "inputCostPerMillion": 17.5,
    "outputCostPerMillion": 105.0,
    "cacheReadCostPerMillion": 1.75,
    "cacheCreationCostPerMillion": 21.875,
    "dailySlots": [{ "label": "原价根-峰时", "windows": [{ "startMinute": 480, "endMinute": 720 }, { "startMinute": 840, "endMinute": 1080 }], "inputCostPerMillion": 20.0, "outputCostPerMillion": 120.0, "cacheReadCostPerMillion": 2.0, "cacheCreationCostPerMillion": 25.0 }],
    "contextTiers": [{
      "threshold": 128000,
      "inputCostPerMillion": 35.0,
      "outputCostPerMillion": 210.0,
      "cacheReadCostPerMillion": 3.5,
      "cacheCreationCostPerMillion": 43.75,
      "dailySlots": [{ "label": "原价128K-峰时", "windows": [{ "startMinute": 480, "endMinute": 720 }, { "startMinute": 840, "endMinute": 1080 }], "inputCostPerMillion": 40.0, "outputCostPerMillion": 240.0, "cacheReadCostPerMillion": 4.0, "cacheCreationCostPerMillion": 50.0 }]
    }]
  }],
  "aliases": [],
  "family": "gpt"
}
```

## Authoring Suggestions

1. Write all fields for new models (including an empty `dailySlots: []`) for easier diffing and review
2. Existing models may omit `dailySlots`; it defaults to an empty array
3. For long-term peak/off-peak pricing, use a long-range `timeRules` (e.g. `startTime: 0`) instead of relying only on the model root
4. Peak/off-peak limited to certain weekdays (e.g. weekends all-day off-peak) is expressed with `daysOfWeek` on the slot, e.g. `[1, 2, 3, 4, 5]`; encode former every-day eras as a dedicated `timeRules` entry
5. Bump `version` and update `updatedAt` after changes
