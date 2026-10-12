# 定价浏览网站 / Pricing website

中英文静态浏览与金额试算网站，使用 Vue 3、TypeScript 和 Vite。唯一定价数据源是上一级的 `model_pricing.json`。

A bilingual static pricing browser and cost estimator built with Vue 3, TypeScript and Vite. The parent directory’s `model_pricing.json` is its sole pricing source.

## 本地运行 / Local development

Node.js **22.18+**（推荐 24 LTS）和 npm。以下命令在 `website/` 中执行：

Use Node.js **22.18+** (24 LTS recommended) and npm. Run inside `website/`:

```sh
npm ci
npm run dev
```

开发地址默认是 `http://127.0.0.1:5173`；实际地址以终端输出为准。开发服务器直接读取根目录数据；修改 JSON 后刷新页面即可。

The default development URL is `http://127.0.0.1:5173`; use the URL printed in the terminal. Refresh after editing the root JSON to see changes.

## 校验和构建 / Validation and build

```sh
npm run check
npm test
npm run build
npm run preview
```

`check` 包含 Vue/TypeScript 类型检查和定价数据校验。构建前校验严格 Schema、上下文阈值、日期和每日区间、星期交集、名称冲突及便携正则。网站测试覆盖中国时区、区间边界、三层规则隔离、模型身份、汇率换算、四项金额试算、输入校验及双语覆盖。

`check` runs Vue/TypeScript checks and pricing-data validation. Validation covers the strict schema, thresholds, date/daily ranges, weekday intersections, name collisions and portable patterns. Tests cover China time, boundaries, three-layer isolation, model identities, conversion, four-part cost estimates, token validation and translation coverage.

产物是 `website/dist/`，其中 JSON 与根目录原文件字节一致。`dist/`、`node_modules/`、本地环境文件和缓存均由根 `.gitignore` 忽略。提交源码、`package.json` 和 `package-lock.json`；不要提交构建产物。

The output is `website/dist/`, including a byte-identical copy of the root JSON. Build output, dependencies, local environment files and caches are ignored. Commit source files and the package/lock files only.

## 金额试算 / Cost estimates

点击搜索栏旁的“金额试算”，打开右下角的小型悬浮面板，填写输入、输出、缓存读取和缓存创建 **实际 token 数量**，可用于累计用量比较。输入数字自动按千位添加逗号，例如 `10,431,043`；可粘贴带逗号或不带逗号的整数，编辑时保留光标位置。输入仅指未缓存部分，不要重复包含已单列的缓存读取或创建。四项及其合计必须为非负安全整数；空白、负数、小数或过大数值显示提示，预估金额显示 `—`。

Select **Estimate cost** beside the search bar to open a compact floating panel at the bottom right. Enter the **actual token counts** for uncached input, output, cache read and cache creation, including cumulative usage for comparisons. Inputs automatically add thousands separators, e.g. `10,431,043`, accept pasted integers with or without commas, and preserve the cursor while editing. Do not repeat cache reads or writes in uncached input. Counts and their sum must be nonnegative safe integers. Empty, negative, fractional or excessive counts produce an error and `—` estimates.

悬浮面板不占排行榜的纵向空间；“完成·收起”、标题栏收起按钮或 Escape 会保留用量、金额列和排序，右下角“编辑用量”可重新打开。“关闭试算”保留用量但移除金额列，金额排序恢复为数据顺序。用量及计价说明可展开查看。排序菜单可选金额从低到高或从高到低，桌面金额列标题也可点击切换方向。

The floating panel does not push the rankings down. **Done · Minimize**, the heading’s minimize button or Escape retain usage, estimates and sorting; **Edit usage** at the bottom right reopens it. **Close estimate** retains entered counts but removes the amount column and resets cost sorting to data order. Usage and pricing notes expand on demand. The sort menu offers costs from low to high or high to low; clicking the desktop amount column heading also toggles direction.

面板只有“翻译”和“Coding”两个场景入口；点击 Coding 弹出三个缓存案例，选中即填入四项用量。四个案例均可手动修改：

The panel has two scenario buttons: Translation and Coding. Coding opens a dialog with three cache cases; choosing one fills all four counts. All four cases remain editable:

| 案例 / Case | 输入 / Input | 输出 / Output | 缓存读取 / Cache read | 缓存创建 / Cache creation |
| --- | ---: | ---: | ---: | ---: |
| 翻译（无缓存） / Translation (no cache) | 100,000,000 | 100,000,000 | 0 | 0 |
| Coding 极高缓存 98.5% / Very high cache 98.5% | 1,543,648 | 401,147 | 98,055,205 | 0 |
| Coding 高缓存 95% / High cache 95% | 5,136,612 | 628,415 | 94,234,973 | 0 |
| Coding 低缓存 90% / Low cache 90% | 10,431,043 | 503,899 | 89,065,058 | 0 |

翻译为 1 亿输入 + 1 亿输出，合计 2 亿。三个 Coding 案例按用户提供截图的分项比例折算为合计 **100,000,000** tokens；缓存创建均为 0。原始输入 / 输出 / 缓存读取分别为图一 `2.3M / 597.7K / 146.1M`、图二 `18.8M / 2.3M / 344.9M`、图三 `11.7M / 565.2K / 99.9M`。以四项之和为归一化分母（不用已舍入的总计）；向下取整后，将剩余 token 分配给小数余数最大的项，确保总量准确、每项误差小于 1 token。“95%”“90%”仅为近似案例名称，数值不被强行改成这两个精确百分比。

极高缓存标题显示命中率：缓存读取 /（输入 + 缓存读取 + 缓存创建），四舍五入至一位小数为 98.5%。弹窗的用量简写为 `M`（百万，截取至两位小数）或 `K`（千，截取至一位小数），例如 `5.13M`、`94.23M`、`401.1K`；悬停可查看原始整数，选中和计算仍使用完整精度。

Translation uses 100M input + 100M output, totaling 200M. Each Coding case scales the supplied screenshot’s four counts to exactly **100,000,000** tokens, with zero cache creation. Source input / output / cache read counts are `2.3M / 597.7K / 146.1M`, `18.8M / 2.3M / 344.9M` and `11.7M / 565.2K / 99.9M`. The denominator is the sum of the four displayed counts, not the rounded headline total. After flooring, remaining tokens go to the largest fractional remainders, keeping the total exact and each error below one token. “95%” and “90%” are approximate case names; counts are not forced to those exact percentages.

The very-high-cache title shows its hit rate: cache read / (input + cache read + cache creation), rounded to one decimal as 98.5%. Dialog counts use `M` (millions, truncated to two decimals) or `K` (thousands, truncated to one decimal), such as `5.13M`, `94.23M` and `401.1K`. Hovering shows the original integer; selection and calculations retain full precision.

试算按用户要求 **忽略上下文阶梯价格**，使用当前 `timeRules` 容器（未命中则为模型根）的四项基础定价及该容器自己的 `dailySlots`。不会把累计用量当成单次请求上下文，也不会使用任何 tier（包括阈值为 0 的 tier）的价格或峰时规则；网站完整规则浏览与数据规范仍保留原有三层语义。

Estimates **ignore context tiers** as requested. They use the four base rates of the active `timeRules` container (or model root outside those periods) and only that container’s own `dailySlots`. Cumulative usage never determines a request context. No tier rates or schedules are used, including tiers with threshold zero. Full rule browsing and the data specification retain their original three-layer semantics.

金额公式为 `Σ(tokens × 单价 / 1,000,000)`，各项在求和前不舍入。当前时刻和中国时区决定日期与峰时价格，面板显示实际使用时间。价格表增加每个模型的预估金额并支持排序；展开模型展示基础单价、费用明细、时期和峰时规则。人民币/美元沿用全站汇率切换；四项原始单价列仍展示最低上下文档位，与试算费用明细可能不同。

The formula is `Σ(tokens × rate / 1,000,000)`, without rounding subtotals before summing. The displayed current time and China timezone determine date periods and peak rates. The model list gains estimated costs and cost sorting. Expanding a model shows base rates, subtotals, price period and peak schedule. Currency follows the site-wide exchange rate. Overview rate columns still show the lowest context band and may differ from estimate rates.

## 展示语义 / Display semantics

- 列表按浏览时刻选择当前 `timeRules` 容器，展示该容器最低有效上下文档位的非峰时价格及其峰时价格。有多个峰时价格时显示最小值至最大值；展开后逐条列出，互不合并。
- 阶梯范围使用原始 token 数量，不把 `128000` 改写成含义模糊的 `128K`。上下文大小为输入加缓存读取；阈值下限包含，上限不包含。
- 每日时段和 ISO 星期固定使用 **Asia/Shanghai / UTC+08:00**，不受访问者所在时区影响。每日区间为 `[start, end)`，绝对日期区间包含两端。
- 命中时间规则后不借用模型根的阶梯或峰时价格；命中阶梯后不借用容器根的峰时价格。
- 模型详情列出当前全部档位、默认价格、全部历史/未来时期，以及原样保留的历史名称和正则规则。
- 搜索支持名称子串和完整 API 别名。完整名称按全表 `modelId` → `aliases` → `aliasPatterns` 优先级识别，忽略 ASCII 字母大小写；不剥离前后缀或变体。子串搜索只是浏览过滤，不推断模型身份或价格。
- 人民币是数据本位币。美元 = 人民币 / `usdExchangeRate`（缺省 7）；按最多八位有效数字展示，零值明确保留，不将极小非零价格四舍五入成零。

- The overview uses the current absolute-date container and its lowest valid context band. Off-peak and peak rates are shown separately. Multiple peak rates appear as a range; details list each schedule separately.
- Context bands use exact token counts. Context = input + cache read. Lower bounds are inclusive; upper bounds are exclusive.
- Daily schedules and ISO weekdays use **Asia/Shanghai / UTC+08:00**, independently of the visitor’s timezone. Daily windows are half-open; absolute date ranges include both endpoints.
- Date containers and context tiers use their own rules, never inheriting a different node’s peak rates.
- Details include all current bands, default prices, all historical/future periods, and preserved historical names and regex patterns.
- Search supports partial names and complete API aliases. Full-name identification uses global ID → historical alias → regex precedence with ASCII case folding and no prefix/suffix stripping. Partial search only filters the view.
- USD is RMB divided by the table’s exchange rate (default 7). Display uses up to eight significant digits without rounding tiny paid rates to zero.

语言和货币偏好保存在浏览器本地；存储不可用时网站仍可浏览。网址可指定 `?lang=en&currency=USD`、`q` 和 `family`，界面切换同步更新这些参数，便于收藏当前筛选。详情里的模型链接保留语言和货币，使用 `#model=<编码后的 modelId>` 定位并展开。

Language and currency preferences are stored locally; browsing still works without storage. URLs accept `lang=en`, `currency=USD`, `q` and `family`, and update as those controls change so a filtered view can be bookmarked. Model links retain language/currency and use `#model=<encoded modelId>` to open and scroll to the model.

现有中文规则标签均提供英文翻译；模型 ID、别名、正则和无法识别的自定义标签保持原文。增加新规则标签时，在 `src/lib/i18n.ts` 的标签映射中补齐英文；测试会检查数据里是否存在未翻译的中文规则标签。

Existing Chinese rule labels have English translations. IDs, aliases, patterns and unknown custom labels remain verbatim. Add translations in `src/lib/i18n.ts` when introducing new Chinese rule labels; tests detect missing translations.

## 发布 / Deployment

仓库包含 `.github/workflows/website.yml`：拉取请求运行校验与构建；`master` 上相关源码/数据变更触发校验、构建和 GitHub Pages 发布；也支持手动运行。产物通过 Actions artifact 部署，不写入 Git 分支。

`.github/workflows/website.yml` validates and builds pull requests, and deploys relevant `master` changes to GitHub Pages, with manual dispatch also available. Output is deployed as an Actions artifact, never committed to a branch.

本仓库已启用 GitHub Actions Pages，站点地址为 [https://laoyuehanni.github.io/model-price-table/](https://laoyuehanni.github.io/model-price-table/)。在新仓库首次启用时，将 **Settings → Pages → Source** 设置为 **GitHub Actions**，然后推送代码或手动运行工作流。

GitHub Actions Pages is enabled for this repository at [https://laoyuehanni.github.io/model-price-table/](https://laoyuehanni.github.io/model-price-table/). For a new repository, set **Settings → Pages → Source → GitHub Actions**, then push or dispatch the workflow.

也可部署到其他静态平台：项目根目录作为 checkout/build root，执行 `npm ci --prefix website && npm run build --prefix website`，发布目录为 `website/dist`。不要仅检出 `website/`，构建还需要根目录定价 JSON 和 Schema。相对资源路径同时支持域名根目录和项目子路径；不需要 SPA rewrite。

Other static hosts can run `npm ci --prefix website && npm run build --prefix website` from the repository root and publish `website/dist`. Keep the full repository available: the build needs the root pricing JSON and schema. Relative asset URLs support domain roots and project subpaths without SPA rewrites.

每次更新价格数据后重新构建发布。页面通过同源 JSON 读取部署快照，使用 `no-cache` 请求重新验证缓存；没有第三方运行时字体、脚本或数据请求。

Rebuild and deploy after data updates. The page reads the deployed JSON from the same origin with cache revalidation. It makes no runtime requests for third-party fonts, scripts or pricing data.
