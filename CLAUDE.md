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
5. Optional per model: `dailySlots`, `contextTiers`, `timeRules`, `aliases`, `family`.
6. All JSON must parse and strictly match the documented shape (exact field names, casing, and types).

## Pricing rules (three layers, mutually exclusive — exactly one price wins)
1. **Container** — match `timeRules` (absolute Unix date ranges); else use the model root.
2. **Node** — inside the container, resolve `contextTiers` (pick the largest tier with `threshold <= contextSize`, where `contextSize = input + cacheRead`); else use the container root price.
3. **Peak/off-peak** — on the chosen node, match `dailySlots`; else use that node's off-peak price.

Constraints:
- A node's own four prices are its **off-peak / other-time** price.
- `dailySlots` is the node's peak-time override and **must not** nest another `contextTiers`.
- Once a tier matches, only that tier's `dailySlots` apply (never borrow the root peak price).
- `dailySlots.windows[]` use minutes of day `0..1440`, half-open interval `[start, end)`; windows within one pricing node must not overlap; a window may not cross midnight (split into two).
- `dailySlots` may attach to: model root, any `contextTier`, or any `timeRule` root.
- Multiple `timeRules` in the same model must not have overlapping date ranges.

## Authoring rules
1. **New models**: write every recommended field, including empty arrays (`"dailySlots": []`, `"contextTiers": []`, `"timeRules": []`) for clean diffs.
2. **Existing models**: `dailySlots` may be omitted (defaults to an empty array).
3. **Never invent prices.** Only set values you can attribute to a reliable source; otherwise state that data is missing and ask.
4. Keep `modelId` / `aliases` stable; aliases group API names that share the same pricing. Avoid duplicate `modelId`s.
5. When conventions change, keep the full example JSON in `README.md` / `README_zh.md` in sync.

## Update / release checklist
1. Bump `version` (increment the integer) and refresh `updatedAt` to the current Unix time in seconds.
2. Validate the JSON: parses cleanly, matches the schema, all ranges/types correct.
3. If pricing semantics changed, update this guide and the README specs (both languages) plus the full example.
4. Commit with a focused message, e.g.:
   - `pricing: add Model-X`
   - `pricing: update output price of Model-Y`
   - `docs: ...`

## Interaction conventions
- This is a **data repository**: be precise and minimal, change only what is asked.
- Before adding or updating a model, find the existing entry and diff against the new values.
- When data is ambiguous or missing, ask instead of guessing.
