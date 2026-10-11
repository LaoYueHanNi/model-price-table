# model-price-table — AI Agent Guide

This repository maintains **`model_pricing.json`**, a machine-readable pricing table for LLM models. Schema compatibility is a hard requirement: never rename fields, change value types, or alter rule semantics.

## Reference documents
- [`README.md`](./README.md) — full English schema specification
- [`README_zh.md`](./README_zh.md) — identical specification in Chinese

## Repository rules
1. `model_pricing.json` is the **only source of truth** for model pricing.
2. Currency: **RMB**. Unit price: **per million tokens**.
3. Top-level fields: `version` (int), `updatedAt` (Unix seconds), `currency` (`"RMB"`), `usdExchangeRate` (number, RMB per USD, default `7`, used for USD-denominated pricing), optional `families`, and `models` (array of model entries).
4. Every model entry requires `modelId` plus the four cost fields:
   - `inputCostPerMillion`
   - `outputCostPerMillion`
   - `cacheReadCostPerMillion`
   - `cacheCreationCostPerMillion`
5. Optional per model: `dailySlots`, `contextTiers`, `timeRules`, `aliases`, `aliasPatterns`, `family`.
6. All JSON must parse and strictly match the documented shape (exact field names, casing, and types).

## Model identification (before pricing)
- Resolve across the entire table: exact `modelId`, then exact `aliases`, then optional `aliasPatterns` regex fallback. All three stages ignore ASCII letter case (A-Z/a-z); preserve stored IDs/aliases and do not strip prefixes or suffixes. Compare exact names with ASCII case folding; compile regex patterns with the ECMAScript i flag (no other flags).
- `aliases` is deprecated and frozen for backward compatibility: preserve existing fields and all values unchanged; do not add, update, or delete values. New models may omit it or use `[]`. Maintain all new alias names exclusively in `aliasPatterns`, using anchored escaped literal patterns for single exact names. Consumers must continue historical exact-alias matching.
- `aliasPatterns` is an optional array of unique, non-empty regex strings on the model root; omitted means `[]`. Any pattern can match; multiple patterns for one model count as one match.
- Require `^` and `$`, no delimiters or flags in stored strings (the consumer supplies i), and a match spanning the entire input (reject trailing newlines). Use portable ECMAScript literals, escaped punctuation, grouping, alternation, and optional `?` components; prohibit wildcards, unbounded quantifiers, lookarounds, backreferences, and inline flags. Invalid patterns are validation errors.
- Multiple models matching at the same stage are an ambiguity error; never resolve by array order. Unknown names have no inferred price. After identification, apply the existing three-layer pricing rules.
- `fast`, `pro`, `mini`, and other identity components are mandatory parts of distinct model IDs, not reasoning levels. Ordinary-model patterns must reject these variants; Fast-model patterns must require `fast`, including names with effort before `fast`. Preserve identity components such as `max` in `gpt-5.1-codex-max`.
- Only group names confirmed to share the entire pricing rules. Retain existing IDs and aliases. Old strict-schema consumers must update their schema; regex fallback requires consumer support.

## Pricing rules (three layers, mutually exclusive — exactly one price wins)
1. **Container** — match `timeRules` (absolute Unix date ranges); else use the model root.
2. **Node** — inside the container, resolve `contextTiers` (pick the largest tier with `threshold <= contextSize`, where `contextSize = input + cacheRead`); else use the container root price.
3. **Peak/off-peak** — on the chosen node, match `dailySlots`; else use that node's off-peak price.

Constraints:
- A node's own four prices are its **off-peak / other-time** price.
- `dailySlots` is the node's peak-time override and **must not** nest another `contextTiers`.
- Once a tier matches, only that tier's `dailySlots` apply (never borrow the root peak price).
- `dailySlots.windows[]` use minutes of day `0..1440`, half-open interval `[start, end)`; windows within one pricing node must not overlap; a window may not cross midnight (split into two). A slot may carry optional `daysOfWeek` (ISO `1`=Monday … `7`=Sunday; omitted = every day); only slots whose `daysOfWeek` intersect must not have overlapping windows.
- `dailySlots` may attach to: model root, any `contextTier`, or any `timeRule` root.
- Multiple `timeRules` in the same model must not have overlapping date ranges.

## Authoring rules
1. **New models**: write every recommended field, including empty arrays (`"dailySlots": []`, `"contextTiers": []`, `"timeRules": []`, `"aliasPatterns": []`) for clean diffs.
2. **Existing models**: `dailySlots` may be omitted (defaults to an empty array).
3. **Never invent prices.** Only set values you can attribute to a reliable source; otherwise state that data is missing and ask.
4. Keep `modelId` stable and deprecated `aliases` frozen. Add new aliases only through `aliasPatterns`, grouping names confirmed to share the entire pricing rules. Avoid duplicate `modelId`s.
5. When conventions change, keep the full example JSON in `README.md` / `README_zh.md` in sync.

## Update / release checklist
1. Refresh `updatedAt` to the current Unix time in seconds on every data change. Bump `version` (increment the integer) **only when the change can affect pricing resolution** — consumers use `version` to decide whether to re-fetch the table:
   - **Must bump**: adding/removing/renaming a `modelId`; adding/removing `aliases`; adding/removing/changing `aliasPatterns`; changing any of the four cost fields; adding/removing/changing `contextTiers`, `timeRules`, `dailySlots`; changing `usdExchangeRate`; changing model-identification semantics such as case sensitivity.
   - **May skip bump** (refresh `updatedAt` only): changes that cannot affect which price a request resolves to, e.g. display-only fields such as `families[].label` or a model's `family` value/rename.
2. Validate the JSON: parses cleanly, matches the schema, all ranges/types correct. Compile patterns, check all known IDs/aliases for case-insensitive collisions and cross-model matches, and run `node --test tests/alias_patterns.test.cjs` for model-identity isolation.
3. If pricing semantics changed, update this guide and the README specs (both languages) plus the full example.
4. Commit with a focused message, e.g.:
   - `pricing: add Model-X`
   - `pricing: update output price of Model-Y`
   - `docs: ...`

## Interaction conventions
- This is a **data repository**: be precise and minimal, change only what is asked.
- Before adding or updating a model, find the existing entry and diff against the new values.
- When data is ambiguous or missing, ask instead of guessing.
