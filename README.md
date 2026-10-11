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

- `contextTiers`, `timeRules`, `dailySlots`, `aliasPatterns`, `family`

`aliases` is deprecated. The examples retain an empty array to illustrate compatibility; new models may omit it or use `[]`, but must not add alias values there.

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
  "aliasPatterns": [],
  "family": "gpt"
}
```

**Defaults**: omitted `dailySlots` / `contextTiers` / `timeRules` / `aliasPatterns` are treated as `[]`.

## Model Identification: `aliases[]` and `aliasPatterns[]`

**`aliases` is deprecated and frozen for backward compatibility.** Keep the existing field and every existing value; do not add, update, or delete its values. Consumers must continue supporting historical exact-alias matching at the priority below. New models may omit `aliases` or use `[]`.

Maintain all new aliases exclusively in optional `aliasPatterns`, which contains regex strings for confirmed names sharing the model's entire pricing rules; any one pattern may match. For a single exact name, use an anchored regex with escaped literal punctuation. Both fields attach only to the model root.

Resolve the request's model name across the entire table in this order:

1. Exact `modelId` match.
2. Exact `aliases` match, only if no `modelId` matched.
3. `aliasPatterns` match, only if neither exact stage matched.

All three identification stages ignore ASCII letter case (`A-Z`/`a-z`). Compare exact names with ASCII case folding and preserve the stored `modelId` and historical `aliases` values. Do not strip prefixes or remove suffixes. At any stage, matches belonging to multiple models are an ambiguity error; never choose by array order. Multiple patterns matching the same model count as one match. No match means unknown model, with no inferred price. After identification, apply the existing three-layer pricing rules unchanged.

Patterns use portable ECMAScript regex syntax. Stored strings contain no delimiters or flags; consumers compile them with the case-insensitive `i` flag only, e.g. `new RegExp(pattern, 'i')` (no `g`, `m`, `s`, or `u`). Start with `^`, end with `$`, and require the matched span to cover the entire string (including rejecting a trailing newline). Escape literal punctuation such as `.` (`\\.` in JSON). Use literal model/version identifiers, grouping, alternation, and `?` for confirmed optional effort components. Do not use wildcards, unbounded quantifiers, lookarounds, backreferences, or inline flags. Consumers must compile and validate patterns when loading the table; invalid patterns are a table-validation error, not a silent fallback.

For example, this rule covers the 13 existing Opus 5.5 aliases:

```json
{
  "modelId": "Claude-Opus-5.5",
  "aliasPatterns": [
    "^claude-opus-5-5(-(thinking-)?(low|medium|high|extra-high|xhigh|max))?$"
  ]
}
```

This identification-only fragment omits required pricing fields. It matches `claude-opus-5-5-thinking-high`, `claude-opus-5-5-high`, and uppercase or mixed-case forms such as `CLAUDE-OPUS-5-5-HIGH` and `Claude-Opus-5-5-Thinking-High`, but rejects `claude-opus-5-5-fast`, unknown versions, and unknown effort levels. Add new names or levels only after confirming their pricing.

**Model identity is mandatory:** `fast`, `pro`, `mini`, and similar model-variant components are part of the model's identity, not removable reasoning levels. Ordinary-model patterns must reject those variants. A Fast model has its own `modelId` and patterns that require `fast`, even when an API places effort before it. For example, `grok-4.7-fast-high` and `grok-4.7-high-fast` belong to `grok-4.7-fast`; neither may match `grok-4.7`. Never make `-fast` optional or infer equivalent pricing by stripping it. If a model identity contains `max`, such as `gpt-5.1-codex-max`, keep that component mandatory too.

**Compatibility:** retain existing `modelId` and `aliases` when adding patterns. Consumers that ignore unknown fields can continue exact matching, but consumers using the old strict schema (`additionalProperties: false`) must update their schema before loading this field. Regex fallback requires consumer support; this data repository does not implement the consumer resolver. Case-insensitive identification also requires consumer support: consumers must update both exact-name comparison and regex compilation; refreshing the table alone cannot change an older resolver. Adding, removing, or changing patterns, or changing identification semantics, requires a `version` bump and an `updatedAt` refresh.

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
  "aliasPatterns": ["^gpt-5\\.6-terra(-(low|medium|high))?$"],
  "family": "gpt"
}
```

The example identifies `gpt-5.6-terra` and `GPT-5.6-TERRA-HIGH` as the same model; the consumer supplies the `i` flag, so no flag field is added to JSON.

## Authoring Suggestions

1. Write all recommended fields for new models (including empty `dailySlots: []` and `aliasPatterns: []`) for easier diffing and review; deprecated `aliases` may be omitted or empty
2. Existing models may omit `dailySlots`; it defaults to an empty array
3. For long-term peak/off-peak pricing, use a long-range `timeRules` (e.g. `startTime: 0`) instead of relying only on the model root
4. Peak/off-peak limited to certain weekdays (e.g. weekends all-day off-peak) is expressed with `daysOfWeek` on the slot, e.g. `[1, 2, 3, 4, 5]`; encode former every-day eras as a dedicated `timeRules` entry
5. Bump `version` and update `updatedAt` after changes
6. Preserve historical `aliases` unchanged; maintain all new alias names exclusively in `aliasPatterns`
