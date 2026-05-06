# 高分 Prompt 公开 API 说明

本文档面向需要直接从网页应用调用高分 Prompt 数据的同事，说明当前公开接口的可用性、语言选择规则、分数解释以及筛选机制。

## 结论

- 可以对外提供给网页应用直接调用
- 接口是公开 GET API，不需要鉴权
- 浏览器可直接跨域请求
- 生产环境基准地址是 `https://api.rwkv.halowang.cloud`

当前最核心的接口是：

- `GET /public-api/evals/high-score-samples`

它返回按语种 / 指定 eval run 和分数阈值筛选后的高分题目分组，每个题目都带有原始 Prompt 文本。

重要更新：

- 如果不传 `runId`，接口按语种返回默认的 2.9B 高分 Prompt。
- 如果传 `runId`，接口只返回该 run 的高分 Prompt，可用于区分 7.2B、2.9B 或其他具体模型版本。
- 返回的每个 `items[]` 现在会带上 `runId`、`runLanguage`、`modelRequest`、`modelNameReportedByServer`，方便调用方确认来源。
- 可通过 `GET /public-api/evals/runs` 获取当前可用的 run 列表和对应 `runId`。

## 主接口

### 1. 获取高分 Prompt

请求地址：

```text
GET https://api.rwkv.halowang.cloud/public-api/evals/high-score-samples
```

支持的 query 参数：

- `runId`：可选。指定某一次 eval run。传入后会精确筛选该 run，适合区分 7.2B / 2.9B 等模型版本。
- `locale`：可选，推荐优先使用。用于指定网页应用当前语种，例如 `zh-CN`、`zh-TW`、`ja`、`en`、`ru`
- `language`：可选，语义上也是指定目标语言，但优先级低于 `locale`
- `minScore`：可选，最小分数阈值

支持的请求头：

- `Application-Language`：可选，自定义应用语种
- `Accept-Language`：可选，浏览器语言

推荐调用方式：

- 如果产品需要 7.2B 或其他非默认模型版本，请显式传 `runId`
- 如果产品只关心当前语种下的默认 2.9B 高分题，请显式传 `locale`
- 不要只依赖浏览器自动附带的 `Accept-Language`
- 如果你们的网页有自己的语言切换器，请把当前界面语种直接映射到 `locale`

模型 / run 选择规则：

1. 如果传了 `runId`，后端按该 run 精确筛选，`locale` / `language` / 请求头不会再影响样本来源。
2. 如果没有传 `runId`，后端按下面的语言解析规则筛选，并且只返回默认 2.9B 数据。

语言解析优先级如下：

1. `locale` query
2. `Application-Language` 请求头
3. `language` query
4. `Accept-Language` 的第一个语言标签
5. 如果以上都没有提供，后端默认回退到 `zh-Hans`

补充说明：

- 语言码会先做归一化，例如 `zh-CN` 会归一到 `zh-Hans`，`zh-TW` / `zh-HK` 会归一到 `zh-Hant`
- 如果最终解析出的语言当前没有公开可用数据，接口不会报错，而是返回空的 `categories`
- 当前产品里常见的公开语言主要是 `zh-Hans`、`zh-Hant`、`ja`、`ko`、`en`、`ru`
- 但接口本身并没有把公开语言硬编码为这 6 个，实际可用语言集合仍取决于后台设置和已导入的 eval run 数据

#### 请求示例

固定获取日语高分 Prompt：

```bash
curl "https://api.rwkv.halowang.cloud/public-api/evals/high-score-samples?locale=ja"
```

固定按 8.5 分阈值获取英文高分 Prompt：

```bash
curl "https://api.rwkv.halowang.cloud/public-api/evals/high-score-samples?locale=en&minScore=8.5"
```

这会返回英文默认 2.9B 高分 Prompt。如果需要英文 7.2B，请使用下面的 `runId` 示例。

固定获取 7.2B 英文高分 Prompt：

```bash
curl "https://api.rwkv.halowang.cloud/public-api/evals/high-score-samples?runId=rwkv7-g1f-7-2b-20260414-en-fastthink-repeat5-appdefaults&minScore=8.5"
```

固定获取 7.2B 简体中文高分 Prompt：

```bash
curl "https://api.rwkv.halowang.cloud/public-api/evals/high-score-samples?runId=rwkv7-g1f-7-2b-20260414-zh-fastthink-repeat5-appdefaults&minScore=8.5"
```

浏览器 `fetch` 示例：

```ts
const response = await fetch(
  'https://api.rwkv.halowang.cloud/public-api/evals/high-score-samples?locale=zh-TW'
)

if (!response.ok) {
  throw new Error(`HTTP ${response.status}`)
}

const data = await response.json()
console.log(data.categories)
```

#### 返回结构

```json
{
  "categories": [
    {
      "category": "life",
      "categoryDisplayName": "Life",
      "averageScore": 8.91,
      "items": [
        {
          "title": "How do I stay motivated when progress feels slow?",
          "prompt": "Please answer in a calm, practical tone and avoid generic motivational clichés.",
          "score": 8.88,
          "runId": "rwkv7-g1f-7-2b-20260414-en-fastthink-repeat5-appdefaults",
          "runLanguage": "en",
          "modelRequest": "7b",
          "modelNameReportedByServer": "rwkv7-g1f-7.2b-20260414-ctx8192"
        }
      ]
    }
  ],
  "minScore": 8.5,
  "runId": "rwkv7-g1f-7-2b-20260414-en-fastthink-repeat5-appdefaults"
}
```

字段说明：

- `minScore`：本次请求实际生效的分数阈值
- `categories`：按题目类别分组后的结果
- `category`：内部类别 key，例如 `life`、`code`、`mathematics`
- `categoryDisplayName`：该类别的人类可读名称
- `averageScore`：当前类别下所有返回题目的平均分
- `items[].title`：题目标题，对应 eval 数据里的 `renderingName`
- `items[].prompt`：题目的原始 Prompt 文本
- `items[].score`：该题目的最终样本分数
- `items[].runId`：该题目来自哪一次 eval run
- `items[].runLanguage`：该 run 的原始语言字段，例如 `zh`、`en`
- `items[].modelRequest`：生成时请求的模型档位，例如 `7b`
- `items[].modelNameReportedByServer`：生成服务上报的模型名称
- 顶层 `runId`：本次请求显式指定的 run；没有传 `runId` 时为 `null`

### 2. 语言探测辅助接口

### 2. 获取可用 eval run 列表

请求地址：

```text
GET https://api.rwkv.halowang.cloud/public-api/evals/runs
```

该接口公开可用，不需要鉴权。它返回当前后台已经导入的 eval run 列表。调用方可以从中读取 `runId`，再传给 `high-score-samples`。

示例：

```bash
curl "https://api.rwkv.halowang.cloud/public-api/evals/runs"
```

常用字段：

- `runId`：高分 Prompt 接口的 `runId` 参数值
- `language`：该 run 的原始语种字段
- `modelNameReportedByServer`：生成服务上报的模型名称
- `averageWeightedScore`：该 run 的整体平均分
- `scoredSampleCount`：该 run 中已有评分的样本数
- `scoredAttemptCount`：该 run 中已有评分的 attempt 数

如果只想在命令行查看这些字段：

```bash
curl -sS "https://api.rwkv.halowang.cloud/public-api/evals/runs" \
  | jq '.[] | {runId, language, modelNameReportedByServer, averageWeightedScore, scoredSampleCount, scoredAttemptCount}'
```

前端产品如果需要让用户选择 7.2B / 2.9B，建议先调用这个接口拿 run 列表，再将用户选中的 `runId` 传给 `high-score-samples`。

### 3. 语言探测辅助接口

请求地址：

```text
GET https://api.rwkv.halowang.cloud/public-api/evals/high-score-languages
```

它支持和主接口相同的语言选择输入，但不支持 `runId`：

- `locale` query
- `language` query
- `Application-Language` 请求头
- `Accept-Language` 请求头

它返回的是“当前请求在同一套语言解析规则下，最终会匹配到哪个公开语言”，而不是完整的全量语种列表。

示例：

```bash
curl "https://api.rwkv.halowang.cloud/public-api/evals/high-score-languages?locale=ja"
```

可能返回：

```json
["ja"]
```

如果当前请求语言没有可用公开数据，可能返回：

```json
[]
```

如果请求里没有提供任何语言信息，则默认返回：

```json
["zh-Hans"]
```

## 分数解释

这部分是对接时最容易误解的地方。

### 1. `items[].score` 代表什么

`items[].score` 对应后端里的 `averageWeightedScore`。

它不是某一次 attempt 的单次得分，而是：

- 先读取该样本每个已评分 attempt 的 `weighted_score`
- 再对这些 `weighted_score` 做算术平均
- 最后保留 2 位小数

也就是说，如果一个题目被重复评测了多次，并且其中有多次已经完成评分，那么公开 API 返回的是这些已评分结果的平均值。

### 2. `averageScore` 代表什么

`categories[].averageScore` 是当前类别下所有返回题目的 `items[].score` 的算术平均值。

它用于展示这个类别整体的高分水平，不等于某一道题的分数。

### 3. `weighted_score` 从哪里来

`weighted_score` 来自导入的 `scores/*.json` 文件。

当前后台会保留这些维度分：

- `relevance`
- `quality`
- `fluency`
- `satisfaction`

但公开高分 Prompt API 本身不会把这些维度分返回给调用方，它只返回最终筛选所使用的样本平均分。

另外需要注意：

- 当前后台会直接读取评分文件里的 `weighted_score`
- 后台不会根据 `relevance` / `quality` / `fluency` / `satisfaction` 重新推导一遍加权公式
- 因此如果评分生成端未来修改了 `weighted_score` 的计算方式，公开 API 也会随之体现这个变化

## 当前筛选机制

### 1. 默认阈值

如果请求没有显式传 `minScore`，后端会使用“当前 pass threshold”作为默认阈值。

当前代码默认值是：

```text
8.5
```

但这里不是永久写死的 8.5：

- 如果后台管理员修改了 eval settings 里的 `passThreshold`
- 那么公开 API 的默认筛选阈值也会跟着变

因此，对接方有两种安全用法：

- 如果希望始终跟随后端当前推荐规则，就不要传 `minScore`
- 如果希望网页产品侧固定使用某个阈值，例如固定 8.5，则显式传 `minScore=8.5`

### 2. 比较关系

当前筛选条件是：

```text
averageWeightedScore >= minScore
```

这意味着 8.5 分会被包含在结果里，不是严格大于 8.5 才返回。

### 3. 语言筛选

在没有传 `runId` 时，后端会按 eval run 的 `language` 做归一化匹配，并且只返回默认 2.9B run。

例如：

- `zh`
- `zh-CN`
- `zh_cn`
- `zh-Hans`

这些都会被视为简体中文数据。

同理：

- `zh-TW`
- `zh-HK`
- `zh-Hant`

这些都会被视为繁体中文数据。

### 4. Run 筛选

如果传入 `runId`，后端会使用精确匹配：

```text
run.runId == runId
```

这种模式适合固定某个模型版本，例如 7.2B 或 2.9B。此时语言参数不会再参与样本来源筛选。

如果 `runId` 不存在，接口不会报错，而是返回空的 `categories`。

### 5. 类别排序

返回结果里的 `categories` 会按固定产品顺序排序，而不是按分数排序：

1. `career`
2. `creation`
3. `family`
4. `life`
5. `role_play`
6. `encyclopedia`
7. `code`
8. `mathematics`

每个类别内部的 `items` 则按样本分数从高到低返回。

### 6. 空结果的含义

如果返回：

```json
{
  "categories": [],
  "minScore": 8.5
}
```

常见原因有三种：

- 当前语言没有公开可用数据
- 传入了不存在的 `runId`
- 当前语言有数据，但没有题目达到分数阈值
- 当前后台还没有导入带评分的 `scores/*.json`
- 不传 `runId` 时，当前语言没有公开可用的 2.9B 数据

这类情况应当按“当前无可展示推荐题”处理，而不是当作接口异常。

## 对接建议

建议前端同事按下面的规则接：

1. 一律显式传 `locale`，不要把语种选择完全交给浏览器头
2. 如果要请求 7.2B 或其他非默认模型版本，请显式传 `runId`
3. 如果想跟随后端当前推荐阈值，就不要传 `minScore`
4. 如果想让网页产品长期固定为“8.5 分及以上”，就显式传 `minScore=8.5`
5. 看到空 `categories` 时，按“当前语种或当前 run 暂无推荐 Prompt”处理
6. 如果只是想确认某个语种当前是否能拿到数据，可以先请求 `high-score-languages`，再请求 `high-score-samples`

## 与 eval zip 数据的关系

公开高分 Prompt API 依赖后台已导入的 eval 数据，尤其依赖 `scores/*.json`。

相关规格说明见：

- [docs/eval-run-zip-format.md](./eval-run-zip-format.md)

如果 zip 里没有评分文件，或者评分文件和样本文件不一致，那么公开 API 无法产出可用的高分题结果。
