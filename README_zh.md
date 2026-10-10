[English](README.md) | 简体中文

# model_pricing.json 编写说明

LLM 模型定价表 [`model_pricing.json`](./model_pricing.json)。

货币单位：**RMB**；单价单位：**每百万 token**。

## 顶层结构

```json
{
  "version": 48,
  "updatedAt": 1785460200,
  "currency": "RMB",
  "families": [{ "id": "gpt", "label": "GPT" }],
  "models": [ /* ... */ ]
}
```

| 字段 | 说明 |
|------|------|
| `version` | 版本号，规则变更后递增，并同步更新 `updatedAt` |
| `updatedAt` | Unix 秒 |
| `currency` | 固定 `RMB` |
| `families` | 可选，模型家族筛选列表 |
| `models` | 模型定价数组 |

## 模型节点

必填：`modelId` + 四维单价。

建议始终写出（无则空数组 / 空字符串）：

- `contextTiers`、`timeRules`、`dailySlots`、`aliasPatterns`、`family`

`aliases` 已废弃。示例保留空数组以展示兼容形式；新模型可省略该字段或写 `[]`，但不得在其中新增别名值。

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

**缺省兼容**：未写 `dailySlots` / `contextTiers` / `timeRules` / `aliasPatterns` 时按 `[]` 处理。

## 模型识别：`aliases[]` 和 `aliasPatterns[]`

**`aliases` 已废弃并冻结，仅用于向后兼容。** 保留已有字段及全部已有值，不再新增、修改或删除其中的值。消费端仍须按下述优先级支持历史别名的精确匹配。新模型可省略 `aliases` 或写 `[]`。

后续所有新别名统一维护到可选的 `aliasPatterns`，其中保存已确认共享该模型完整定价规则的名称正则字符串，任意一条命中即可。单个精确名称也使用带首尾锚点、已转义字面标点的正则。两个字段都只能挂在模型根节点。

对请求中的模型名称，按以下顺序在全表范围识别：

1. 精确匹配 `modelId`。
2. 没有命中任何 `modelId`，才精确匹配 `aliases`。
3. 两个精确阶段均未命中，才匹配 `aliasPatterns`。

名称区分大小写，不自动转小写、删除前缀或移除后缀。任一阶段命中多个模型时视为歧义错误，禁止按数组顺序挑选；多条正则命中同一个模型只算一次。无命中表示未知模型，不推测价格。识别后继续使用原有三层定价规则。

正则使用可跨语言实现的 ECMAScript 语法，不带分隔符或 flags。必须以 `^` 开头、`$` 结尾，并要求匹配范围覆盖整个字符串（包括拒绝末尾换行）。`.` 等字面标点必须转义（JSON 中写成 `\\.`）。使用固定模型名和版本、分组、分支以及表达已确认可选思考级别的 `?`；禁止通配符、无界量词、前后查找、反向引用和内联 flags。消费端加载时必须编译并校验正则；非法正则属于数据校验错误，不能静默回退。

例如，下面的规则覆盖 Opus 5.5 现有的 13 条别名：

```json
{
  "modelId": "Claude-Opus-5.5",
  "aliasPatterns": [
    "^claude-opus-5-5(-(thinking-)?(low|medium|high|extra-high|xhigh|max))?$"
  ]
}
```

此片段仅展示模型识别，省略了必填价格字段。它匹配 `claude-opus-5-5-thinking-high` 和 `claude-opus-5-5-high`，但不匹配 `claude-opus-5-5-fast`、未知版本或未知思考级别。新增名称或级别前，必须确认其定价。

**模型身份不可省略：** `fast`、`pro`、`mini` 等模型变体是模型身份的一部分，不是可移除的思考级别。普通模型正则必须拒绝这些变体。Fast 模型使用独立 `modelId`，其正则必须包含 `fast`，即使 API 将思考级别放在它前面。例如 `grok-4.7-fast-high` 和 `grok-4.7-high-fast` 都属于 `grok-4.7-fast`，不能匹配到 `grok-4.7`。禁止将 `-fast` 设为可选，或删除它后推断同价。模型身份中已有的 `max`（例如 `gpt-5.1-codex-max`）同样必须保留。

**兼容性：** 增加正则时保留已有 `modelId` 和 `aliases`。忽略未知字段的消费端可继续精确匹配；使用旧版严格 Schema（`additionalProperties: false`）的消费端必须先升级 Schema，才能加载此字段。正则回退需要消费端实现，本数据仓库不包含消费端解析器。增删或修改正则必须递增 `version` 并刷新 `updatedAt`。

## 三层定价（互斥命中，唯一单价）

```
1. 容器：命中 timeRules（绝对日期）→ 否则模型根
2. 节点：在容器内 resolveTier(contextTiers) → 否则容器根价
3. 峰谷：在已选节点上匹配 dailySlots → 否则该节点谷价
```

- 节点自身四维单价 = **谷价 / 其他时间**
- `dailySlots` = 该节点的峰时覆盖，**禁止**再嵌套 `contextTiers`
- 命中档位后只用该档的 `dailySlots`，不借用根峰价

## 时间区间 `timeRules[]`

| 字段 | 说明 |
|------|------|
| `label` | 展示名 |
| `startTime` / `endTime` | Unix 秒，闭区间 |
| 四维单价 | 该规则根谷价 |
| `dailySlots` | 可选，规则根峰谷 |
| `contextTiers` | 可选，规则内上下文档位（每档也可挂 `dailySlots`） |

同模型内多条 `timeRules` 的日期区间**不得重叠**。

## 上下文区间 `contextTiers[]`

| 字段 | 说明 |
|------|------|
| `threshold` | 上下文边界（tokens），`contextSize = input + cacheRead` |
| 四维单价 | 该档谷价 |
| `dailySlots` | 可选，该档峰谷 |

选档规则：`threshold <= contextSize` 的最大档。

## 峰谷 `dailySlots[]`

挂在：**模型根** / **任一 contextTier** / **任一 timeRule 根**。

```json
{
  "label": "峰时",
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

| 字段 | 说明 |
|------|------|
| `windows[].startMinute` / `endMinute` | 当天分钟 `0..1440`，半开区间 `[start, end)` |
| `daysOfWeek` | 可选，本槽适用的 ISO 星期几：`1`=周一 … `7`=周日；缺省 = 每天 |
| 四维单价 | 峰时价 |

约束：

- 同一价格节点内，`daysOfWeek` 有交集的槽位其 windows **不得重叠**
- 不支持单窗口跨午夜（拆成两段，如 `22:00-24:00` + `00:00-02:00`）
- 未写 `daysOfWeek` 的槽位按每天生效；星期几与 `windows` 使用同一时钟
- 空数组 = 该节点全天谷价

分钟换算：`08:00 → 480`，`12:00 → 720`，`14:00 → 840`，`18:00 → 1080`。

## 最全示例（时间 + 上下文 + 峰谷）

精简结构示例如下：

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

## 编写建议

1. 新模型写全建议字段（含空 `dailySlots: []` 和 `aliasPatterns: []`），便于 diff 与审阅；已废弃的 `aliases` 可省略或为空数组
2. 存量模型可不补 `dailySlots`，按缺省空数组处理
3. 需要长期峰谷时，用长区间 `timeRules`（如 `startTime: 0`）承载，不必只靠模型根
4. 仅部分星期生效的峰谷（如周末全天谷价）用槽位上的 `daysOfWeek` 表达，如 `[1, 2, 3, 4, 5]`；此前"每天峰谷"的历史期用专门的 `timeRules` 还原
5. 修改后递增 `version` 与 `updatedAt`
6. 保留历史 `aliases` 不变，后续所有新别名名称统一维护到 `aliasPatterns`
