# DR: 将已确认历史别名补充为严格限定的正则

Status: implemented

## Problem

消费端 dsh-token-usage 仅使用 modelId 和 aliasPatterns 识别模型，忽略冻结的 aliases；历史名称 deepseek-v4-flash-0731、deepseek-flash 和 ox-alpha-free 因缺少正则失去自动定价匹配。补齐三个名称后的 v114 仍有 70 个历史名称缺少完整名称覆盖：58 个在消费者中无法识别，12 个仅依靠其 provider 前缀归一化识别。基础名称没有思考级别并不意味着任意后缀共享定价。

## Decision

初次补齐三个名称使用：deepseek-v4-flash 的 `^deepseek-v4-flash(-0731)?$`、deepseek-v4.1-flash 的 `^deepseek-flash$`、ox-alpha 的 `^ox-alpha-free$`。deepseek-flash 明确属于 v4.1-flash，不归到 v4-flash。

完整补齐阶段重新检查当前 JSON 与消费者的 v114 审计清单，确认剩余 70 个名称及原目标与本仓库审计一致；向 60 个模型追加 70 条首尾锚定的字面正则。只使用既存 aliases 的所属条目确定目标，不根据名称相似度推断同价。完整名称包括已确认的 provider 前缀、日期、free、preview、latest 和 tiered；Fast 基础名称映射到独立 Fast 模型。Claude-Fable-5.1、Claude-Opus-4.8 等模型追加基础 API 名规则，保留已有思考级别表达式。

存储的正则不含分隔符或 flags，消费端使用 i 并校验匹配覆盖整个输入。字面点号转义；无分隔符的正则字符串使用普通字面字符 / 和 :，测试的字符白名单同步允许这两个字符，不允许通配符或无界量词。已有 modelId、aliases、aliasPatterns、价格及三层定价规则均保留。初次版本从 113 升至 114，完整补齐升至 115，每次刷新 updatedAt。上游文档中的历史 aliases 兼容阶段继续保留；本次不将单个消费端的简化流程改写为上游全表契约，也不依赖去前缀才能完整匹配。

回归测试移除测试副本中的 aliases，以全部 255 个历史别名及 212 个 modelId 为样本，验证原名、小写、大写和混合大小写均通过 modelId + aliasPatterns 唯一映射到原目标，同时独立检查正则跨模型命中，避免精确 ID 优先级掩盖歧义。全体样本验证未知后缀、未知日期、未知 provider 前缀及末尾换行拒绝；专门验证标点、基础 API 名与 fast/mini/pro 身份隔离。补齐前后的统计及规则见[历史别名覆盖审计](../../audits/2026-10-11-historical-alias-patterns.md)。

## Alternatives considered

**允许任意版本、日期或后缀。** 这种规则会纳入未确认同价的模型或变体，破坏身份隔离，因此只列出确认的固定名称。

**改写已有规则，将日期与基础名称合并为可选段。** 已确认范围内可以这样实现，但逐项追加锚定字面规则能完整保留已有匹配集合，便于逐名称审查，不必引入额外可选组合。因此仅保留最初确认的 -0731 可选规则，其余缺口使用固定名称。

## Consequences

- 换来：全部历史 aliases 都由 modelId 或完整名称正则承接；255 个历史名称中 252 个有所属模型的正则覆盖，另外 3 个可由 modelId 忽略大小写直接识别，无剩余未确认映射。
- 代价：追加字面规则使全表正则从 v114 的 43 条增加到 113 条，维护时仍需要全表检查；latest 等动态名称仍遵循当前既存映射，未来归属变化需要明确更新，不能自动推断。
- 维护：保留冻结的 aliases，并使用全表跨模型匹配检查防止正则归属发生冲突。
