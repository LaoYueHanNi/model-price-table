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

- `contextTiers`、`timeRules`、`dailySlots`、`aliases`、`family`

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

**缺省兼容**：未写 `dailySlots` / `contextTiers` / `timeRules` 时按 `[]` 处理。

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
  "inputCostPerMillion": 20.0,
  "outputCostPerMillion": 120.0,
  "cacheReadCostPerMillion": 2.0,
  "cacheCreationCostPerMillion": 25.0
}
```

| 字段 | 说明 |
|------|------|
| `windows[].startMinute` / `endMinute` | 当天分钟 `0..1440`，半开区间 `[start, end)` |
| 四维单价 | 峰时价 |

约束：

- 同一价格节点内 windows **不得重叠**
- 不支持单窗口跨午夜（拆成两段，如 `22:00-24:00` + `00:00-02:00`）
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
  "dailySlots": [{ "label": "模型根-峰时", "windows": [{ "startMinute": 480, "endMinute": 720 }], "inputCostPerMillion": 16.0, "outputCostPerMillion": 96.0, "cacheReadCostPerMillion": 1.6, "cacheCreationCostPerMillion": 20.0 }],
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

## 编写建议

1. 新模型写全字段（含空 `dailySlots: []`），便于 diff 与审阅
2. 存量模型可不补 `dailySlots`，按缺省空数组处理
3. 需要长期峰谷时，用长区间 `timeRules`（如 `startTime: 0`）承载，不必只靠模型根
4. 修改后递增 `version` 与 `updatedAt`
