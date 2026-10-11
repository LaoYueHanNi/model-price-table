# 历史别名的 aliasPatterns 覆盖审计

审计日期：2026-10-11。数据版本：114。基于本地 model_pricing.json；此报告是覆盖检查快照，定价数据仍仅以该 JSON 为准。

本次追加规则：

| modelId | 已追加的正则字符串 |
|---|---|
| `deepseek-v4-flash` | `^deepseek-v4-flash(-0731)?$` |
| `deepseek-v4.1-flash` | `^deepseek-flash$` |
| `ox-alpha` | `^ox-alpha-free$` |

## 检查口径与结果

使用消费端传入的 ECMAScript i 标志和完整匹配长度校验，按全表 modelId → aliasPatterns 两个阶段模拟忽略 aliases 的消费端。检查所有历史 aliases 的原始、小写、大写与混合大小写形式，不删除前后缀或修改标点。

全表有 212 个模型、255 个历史别名名称。其中 182 个由所属模型的 aliasPatterns 覆盖，3 个另由 modelId 忽略大小写直接识别；剩余 70 个名称涉及 60 个模型，使用这两个阶段时无法识别。

上游规范仍要求支持历史 aliases 阶段；本次没有将单个消费端的实现改成上游规则，也没有删除或修改冻结的 aliases。

## 可由 modelId 直接识别，无需追加正则

| modelId | 历史别名 |
|---|---|
| `Claude-Opus-5` | `claude-opus-5` |
| `Claude-Sonnet-5` | `claude-sonnet-5` |
| `Claude-Fable-5` | `claude-fable-5` |

## v114 遗漏与建议规则（已在 v115 按表追加）

每个建议只将一个现存历史别名原样转为首尾锚定的字面正则，避免引入未确认的日期、版本、思考级别或任意后缀；目标模型以历史 aliases 所属条目为依据。模型可能已有其他正则，后续应追加而非替换。表中列的是原始正则字符串；写入 JSON 时反斜杠需再转义一次，如 `\.` 写为 `\\.`。字符串不加分隔符或 flags，消费端传入 i。

| 目标 modelId | 尚未覆盖的历史名称 | 建议追加的正则字符串 |
|---|---|---|
| `cursor-auto` | `auto`<br>`default` | `^auto$`<br>`^default$` |
| `agent_review` | `no-price-use-composer` | `^no-price-use-composer$` |
| `MiniMax-M2.7` | `minimin-m2.7` | `^minimin-m2\.7$` |
| `MiniMax-M3` | `minimax-m3-free` | `^minimax-m3-free$` |
| `Claude-3.5-Haiku` | `claude-3-5-haiku-20241022` | `^claude-3-5-haiku-20241022$` |
| `Claude-3.5-Sonnet` | `claude-3-5-sonnet-20241022` | `^claude-3-5-sonnet-20241022$` |
| `Claude-Haiku-4.5` | `claude-haiku-4-5-20251001`<br>`claude-haiku-4-5` | `^claude-haiku-4-5-20251001$`<br>`^claude-haiku-4-5$` |
| `Claude-Opus-4.1` | `claude-opus-4-1-20250805` | `^claude-opus-4-1-20250805$` |
| `Claude-Opus-4` | `claude-opus-4-20250514` | `^claude-opus-4-20250514$` |
| `Claude-Opus-4.5` | `claude-opus-4-5-20251101` | `^claude-opus-4-5-20251101$` |
| `Claude-Opus-4.6` | `claude-opus-4-6-20260206` | `^claude-opus-4-6-20260206$` |
| `Claude-Opus-4.7` | `claude-opus-4-7` | `^claude-opus-4-7$` |
| `Claude-Opus-4.8` | `claude-opus-4-8` | `^claude-opus-4-8$` |
| `Claude-Opus-5.5-Fast` | `claude-opus-5-5-fast` | `^claude-opus-5-5-fast$` |
| `Claude-Sonnet-4` | `claude-sonnet-4-20250514` | `^claude-sonnet-4-20250514$` |
| `Claude-Sonnet-4.5` | `claude-sonnet-4-5-20250929` | `^claude-sonnet-4-5-20250929$` |
| `Claude-Sonnet-4.6` | `claude-sonnet-4-6`<br>`claude-sonnet-4-6-20260217` | `^claude-sonnet-4-6$`<br>`^claude-sonnet-4-6-20260217$` |
| `Claude-Fable-5.1` | `claude-fable-5-1` | `^claude-fable-5-1$` |
| `Claude-Mythos-5.1` | `claude-mythos-5-1` | `^claude-mythos-5-1$` |
| `deepseek-v4-flash` | `deepseek-v4-flash-free`<br>`deepseek-v4-flash-ga-260731` | `^deepseek-v4-flash-free$`<br>`^deepseek-v4-flash-ga-260731$` |
| `deepseek-v4.1-flash` | `deepseek-v4.1-flash-expires-on-0910` | `^deepseek-v4\.1-flash-expires-on-0910$` |
| `deepseek-v4-pro` | `deepseek-v4-pro-0813` | `^deepseek-v4-pro-0813$` |
| `doubao-seed-2-0-pro` | `doubao-seed-2-0-pro-260215` | `^doubao-seed-2-0-pro-260215$` |
| `gemini-3.8-flash` | `gemini-3.8-flash-tiered` | `^gemini-3\.8-flash-tiered$` |
| `glm-5.3` | `glm-latest` | `^glm-latest$` |
| `glm-5.3-flash` | `glm-flash-latest` | `^glm-flash-latest$` |
| `gpt-5.6-sol` | `gpt-daybreak-blue-latest` | `^gpt-daybreak-blue-latest$` |
| `gpt-5.6-cyber` | `gpt-daybreak-red-latest` | `^gpt-daybreak-red-latest$` |
| `grok-4.5` | `grok-4.5-build-free` | `^grok-4\.5-build-free$` |
| `hy3` | `hy3-free` | `^hy3-free$` |
| `hy4` | `hy4-preview` | `^hy4-preview$` |
| `kimi-k2.6` | `k2d6-agent` | `^k2d6-agent$` |
| `kimi-k3` | `k3-256k`<br>`k3-agent`<br>`kimi-code/k3-256k` | `^k3-256k$`<br>`^k3-agent$`<br>`^kimi-code/k3-256k$` |
| `kimi-k2.8` | `k2.8-preview`<br>`k2d8-preview`<br>`k28-agent-preview` | `^k2\.8-preview$`<br>`^k2d8-preview$`<br>`^k28-agent-preview$` |
| `kimi-for-coding` | `kimi-code/kimi-for-coding` | `^kimi-code/kimi-for-coding$` |
| `kimi-for-coding-highspeed` | `kimi-k2.7-code-highspeed` | `^kimi-k2\.7-code-highspeed$` |
| `mimo-v2.5` | `mimo-v2.5-free` | `^mimo-v2\.5-free$` |
| `nemotron-3-super` | `nemotron-3-super-120b-a12b:free`<br>`nemotron-3-super-free` | `^nemotron-3-super-120b-a12b:free$`<br>`^nemotron-3-super-free$` |
| `muse-spark-1.3` | `muse-spark-1.3-0902` | `^muse-spark-1\.3-0902$` |
| `ox-alpha` | `stealth/ox-alpha` | `^stealth/ox-alpha$` |
| `qwen3.6-plus` | `qwen3.6-plus-free` | `^qwen3\.6-plus-free$` |
| `qwen3.8-max` | `qwen3.8-max-0902`<br>`qwen3.8-2.4t-a95b` | `^qwen3\.8-max-0902$`<br>`^qwen3\.8-2\.4t-a95b$` |
| `qwen3.8-flash` | `qwen3.8-flash-next` | `^qwen3\.8-flash-next$` |
| `qwen3.8-27b` | `Qwen3.8-27B-Q4` | `^Qwen3\.8-27B-Q4$` |
| `pareto` | `union-alpha` | `^union-alpha$` |
| `muse-glimmer-30b` | `meta/muse-glimmer-30b` | `^meta/muse-glimmer-30b$` |
| `muse-spark-1.1` | `meta/muse-spark-1.1` | `^meta/muse-spark-1\.1$` |
| `qwen3.7-flash` | `qwen/qwen3.7-flash` | `^qwen/qwen3\.7-flash$` |
| `nemotron-3.5-lightning` | `nvidia/nemotron-3.5-lightning` | `^nvidia/nemotron-3\.5-lightning$` |
| `inception-mercury-2.5-preview` | `inception/mercury-2.5-preview` | `^inception/mercury-2\.5-preview$` |
| `solar-pro-4` | `upstage/solar-pro4` | `^upstage/solar-pro4$` |
| `sakana-namazu` | `sakana/sakana-namazu` | `^sakana/sakana-namazu$` |
| `poolside-laguna-s-2.1` | `poolside/laguna-s-2.1` | `^poolside/laguna-s-2\.1$` |
| `poolside-laguna-xs-2.1` | `poolside/laguna-xs-2.1` | `^poolside/laguna-xs-2\.1$` |
| `inkling` | `thinkingmachines/inkling` | `^thinkingmachines/inkling$` |
| `inkling-small` | `thinkingmachines/inkling-small` | `^thinkingmachines/inkling-small$` |
| `ling-3.0-flash` | `inclusionai/ling-3.0-flash` | `^inclusionai/ling-3\.0-flash$` |
| `ling-3.0-flash-fin` | `inclusionai/ling-3.0-flash-fin` | `^inclusionai/ling-3\.0-flash-fin$` |
| `kat-coder-pro-v2.5` | `kwaipilot/kat-coder-pro-v2.5` | `^kwaipilot/kat-coder-pro-v2\.5$` |
| `bonsai2-27b` | `prism-ml/ternary-bonsai-2-27b` | `^prism-ml/ternary-bonsai-2-27b$` |

## 建议规则的验证与实施注意

- 在内存中将建议规则与现有规则合并后，检查所有已知 modelId、aliases 及其大小写变体，未发现正则跨模型匹配。每条建议均通过原名和大小写变体命中、未知前缀、额外后缀及末尾换行拒绝检查；该检查在 v114 审计时仅在内存执行；上表全部 70 条规则现已在 v115 写入 model_pricing.json。
- `/` 和 `:` 在不使用分隔符的 ECMAScript 正则字符串中是普通字面字符。v114 的 tests/alias_patterns.test.cjs 字符白名单比规范更窄，不接受它们；v115 已同步允许 /、: 的字面字符并补充标点和边界测试，未删除前缀或标点。
- `latest`、`free`、`preview`、日期、提供商前缀等名称按历史映射列出，不能据名称推断额外型号同价。本次按用户授权沿用全部既存映射；未来归属变化仍须重新确认，尤其是会随时间变化的 latest 名称。
- 后续任何规则落地须保留已有 aliases 和价格规则，递增 version、刷新 updatedAt，重新运行 Schema、全表歧义和模型身份隔离检查。

## v115 完整补齐结果

重新读取本地 v114 定价表，并 fetch GitHub/Gitee 核对远程当前 v113，未发现另行补齐的规则。与消费者 D:/Code/dsh-token-usage/docs/testing/2026-10-11-pricing-alias-coverage.md 的 JSON 候选逐项比对：70 个名称及其 60 个目标模型与本报告完全一致。消费者的 58 个失配名称涉及 48 个模型，另有 12 个仅靠 provider 前缀归一化识别，两者合计就是本报告的 70 个完整名称缺口。

候选写法仅一处差异：消费者将 nemotron-3-super-120b-a12b:free 中的冒号写成 \:；本表使用无分隔符模式下的字面 :，避免不必要的转义。语义一致，其余候选相同。

向 60 个模型追加 70 条锚定字面正则，保留原有 43 条规则；总计 113 条，数据版本 115。每条只接受当前既存名称的大小写变体，不泛化日期、版本、provider 前缀或模型变体。Claude-Fable-5.1、Claude-Opus-4.8 等遗漏的基础 API 名通过追加字面规则补齐，思考级别规则保持不变。

所有 255 个历史 aliases 和 212 个 modelId 均使用 modelId + aliasPatterns（不使用 aliases、不去前缀）唯一识别到原目标。252 个历史名称有完整正则覆盖，另 3 个与 modelId 仅大小写不同而由 ID 直接覆盖；剩余缺口为 0，未确认映射为 0。

验收执行 node --test tests/alias_patterns.test.cjs、完整 JSON Schema 校验和定价区间检查、node docs/decisions/check.mjs、git diff --check。回归测试覆盖全部名称的大小写变体、跨模型正则命中、未知后缀和日期、未知 provider 前缀、尾部换行、标点与 fast/mini/pro 身份隔离。

[相关决策记录](../decisions/implemented/2026-10-11-confirmed-historical-alias-patterns.md)
