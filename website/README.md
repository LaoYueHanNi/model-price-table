# 定价浏览网站 / Pricing website

中英文静态浏览网站，使用 Vue 3、TypeScript 和 Vite。唯一数据源是上一级的 `model_pricing.json`；网站没有数据库、管理后台或费用计算器。

A bilingual static pricing browser built with Vue 3, TypeScript and Vite. The parent directory’s `model_pricing.json` is its sole pricing source. No database, admin panel or cost calculator is required.

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

`check` 包含 Vue/TypeScript 类型检查和定价数据校验。构建前校验严格 Schema、上下文阈值、日期和每日区间、星期交集、名称冲突及便携正则。网站测试覆盖中国时区、区间边界、三层规则隔离、模型身份、汇率换算及双语覆盖。

`check` runs Vue/TypeScript checks and pricing-data validation. Validation covers the strict schema, thresholds, date/daily ranges, weekday intersections, name collisions and portable patterns. Tests cover China time, boundaries, three-layer isolation, model identities, conversion and translation coverage.

产物是 `website/dist/`，其中 JSON 与根目录原文件字节一致。`dist/`、`node_modules/`、本地环境文件和缓存均由根 `.gitignore` 忽略。提交源码、`package.json` 和 `package-lock.json`；不要提交构建产物。

The output is `website/dist/`, including a byte-identical copy of the root JSON. Build output, dependencies, local environment files and caches are ignored. Commit source files and the package/lock files only.

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
