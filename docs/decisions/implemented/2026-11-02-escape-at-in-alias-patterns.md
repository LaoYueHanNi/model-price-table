# DR: aliasPatterns 中字面 @ 必须转义

Status: implemented

## Problem

v126 为 grok-4.7 增加 `^grok-4\.7@256k$`，用于识别网关常见的“模型名@上下文”写法。下游 dsh-token-usage 0.4.14 的便携正则编译器只接受裸字面字符 `[A-Za-z0-9_/:-]`、分组、分支、可选 `?` 和转义标点；裸 `@` 会抛 unsupported alias pattern syntax。该插件在加载时逐条编译 aliasPatterns，一条非法模式就使整张表被拒绝（coerceCloudPricing 返回 null，同步报 feed is not a valid RMB pricing table），导致所有 0.4.14 用户无法同步 v126，只能保留旧表。

## Decision

`model_pricing.json` 中该模式改为 `^grok-4\.7\@256k$`（JSON 文本 `"^grok-4\\.7\\@256k$"`）。ECMAScript 中 `\@` 匹配字面 `@`，匹配行为与裸 `@` 等价。

仓库校验规则同步收紧：`tests/alias_patterns.test.cjs` 与 `website/scripts/validate-data.mjs` 先从模式中剥离 `\.`、`\-`、`\@`，再要求剩余字面字符属于 `[A-Za-z0-9_/:-]`、分组、分支、可选 `?`；因此裸 `@` 重新成为校验错误，`@` 必须转义。`README.md`、`README_zh.md` 与 `AGENTS.md` 的语法说明同步更新。

`version` 从 126 升至 127，刷新 `updatedAt`。新增测试继续覆盖 `grok-4.7@256k` 的解析、大小写和拒绝变体；修复后以 dsh-token-usage 0.4.14 的实际编译与整表校验路径验证通过（223 个模型、126 条 aliasPatterns）。

## Alternatives considered

- **在插件端把 `@` 加入字面白名单。** 本次决定只改上游；且 0.4.14 及更早的已安装插件仍会拒绝裸 `@`，仅靠升级插件无法恢复这些用户对已发布表的同步。转义写法对旧消费端立即生效。
- **删除 `@256k` 别名。** 会使网关名称无法定价，直接放弃已确认共享定价规则的需求。
- **上游同时接受裸 `@` 与 `\@`。** 无法阻止维护者再次写出会毒化旧消费端的表；强制转义才能在数据校验阶段提前失败。

## Consequences

- 代价：字面 `@` 必须写成 `\@`（JSON `\\@`），后续维护者需要记住这条规则；网站展示的模式字符串会多一个转义反斜杠。
- 换来：v127 起 0.4.14 等旧消费端可正常整表加载；`grok-4.7@256k` 恢复正常定价；上游校验提前拒绝裸 `@`，避免同类发布事故。
