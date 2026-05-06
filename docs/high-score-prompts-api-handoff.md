# 高分 Prompt API 对接说明（新版）

本文用于交接给需要在网页或 App 中调用高分 Prompt 数据的同事。

生产环境 API 基准地址：

```text
https://api.rwkv.halowang.cloud
```

核心接口：

```text
GET /public-api/evals/high-score-samples
```

该接口是公开 GET API，不需要鉴权，浏览器可以直接跨域请求。

## 这次新版主要变化

现在同一个语种下可能同时存在多个模型版本的 eval run，例如英文同时有 7.2B 和 2.9B。

因此新版接口支持 `runId`：

- 不传 `runId`：按语种返回默认的 2.9B 高分 Prompt。
- 传 `runId`：只返回指定 eval run 的高分 Prompt，适合明确区分 7.2B / 2.9B。

如果产品需要 7.2B 或其他非默认模型版本，一定要传对应的 `runId`。

## 推荐调用方式

### 1. 固定获取 7.2B 英文高分 Prompt

```bash
curl "https://api.rwkv.halowang.cloud/public-api/evals/high-score-samples?runId=rwkv7-g1f-7-2b-20260414-en-fastthink-repeat5-appdefaults&minScore=8.5"
```

### 2. 固定获取 7.2B 简体中文高分 Prompt

```bash
curl "https://api.rwkv.halowang.cloud/public-api/evals/high-score-samples?runId=rwkv7-g1f-7-2b-20260414-zh-fastthink-repeat5-appdefaults&minScore=8.5"
```

### 3. 按语种获取默认 2.9B 英文高分 Prompt

这种写法不传 `runId`，会返回英文 2.9B 高分 Prompt。

```bash
curl "https://api.rwkv.halowang.cloud/public-api/evals/high-score-samples?locale=en&minScore=8.5"
```

## 当前常用 runId

调用方也可以通过公开接口动态获取当前可用的 run 列表：

```text
GET https://api.rwkv.halowang.cloud/public-api/evals/runs
```

示例：

```bash
curl "https://api.rwkv.halowang.cloud/public-api/evals/runs"
```

如果只想提取对接高分 Prompt 时最常用的字段：

```bash
curl -sS "https://api.rwkv.halowang.cloud/public-api/evals/runs" \
  | jq '.[] | {runId, language, modelNameReportedByServer, averageWeightedScore, scoredSampleCount, scoredAttemptCount}'
```

前端可以用这个接口展示模型 / run 选择器，用户选中某个 run 后，再把对应的 `runId` 传给 `high-score-samples`。

| 模型 | 语种 | runId |
|---|---|---|
| 7.2B | 简体中文 | `rwkv7-g1f-7-2b-20260414-zh-fastthink-repeat5-appdefaults` |
| 7.2B | 英文 | `rwkv7-g1f-7-2b-20260414-en-fastthink-repeat5-appdefaults` |
| 2.9B | 简体中文 | `2026-03-25_231448_rwkv7-2-9b-g1e-20260312-ctx8192-mlx-6bit-zip` |
| 2.9B | 英文 | `2026-04-03_105246_rwkv7-2-9b-g1e-20260312-ctx8192-mlx-6bit-zip_multilingual_5lang_en` |

## Query 参数

| 参数 | 必填 | 说明 |
|---|---:|---|
| `runId` | 否 | 指定某一次 eval run。推荐在需要区分模型版本时传。 |
| `locale` | 否 | 指定当前界面语种，例如 `zh-CN`、`zh-TW`、`en`、`ja`、`ko`、`ru`。不传 `runId` 时用于选择默认 2.9B 的目标语种。 |
| `language` | 否 | 也可指定语言，优先级低于 `locale`。 |
| `minScore` | 否 | 最小分数阈值，例如 `8.5`。不传时使用后台当前 pass threshold。 |

语言解析优先级：

1. `locale` query
2. `Application-Language` 请求头
3. `language` query
4. `Accept-Language` 的第一个语言标签
5. 如果都没有提供，默认使用 `zh-Hans`

传入 `runId` 时，后端按 `runId` 精确筛选，语言参数不再决定样本来源。

## 返回结构

示例：

```json
{
  "categories": [
    {
      "category": "career",
      "categoryDisplayName": "Career & Education",
      "averageScore": 9.12,
      "items": [
        {
          "title": "Prepare for teaching demo lesson",
          "prompt": "I'm a finalist for a high school history position and must teach a 15-minute demo lesson...",
          "score": 10,
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

| 字段 | 说明 |
|---|---|
| `minScore` | 本次请求实际使用的分数阈值。 |
| `runId` | 本次请求指定的 run。没有传 `runId` 时为 `null`。 |
| `categories[]` | 按类别分组后的高分 Prompt。 |
| `categories[].category` | 类别 key，例如 `career`、`life`、`code`。 |
| `categories[].categoryDisplayName` | 类别显示名称。 |
| `categories[].averageScore` | 当前类别下返回题目的平均分。 |
| `items[].title` | 题目标题。 |
| `items[].prompt` | 原始 Prompt 文本。 |
| `items[].score` | 样本平均分，对应后台 `averageWeightedScore`。 |
| `items[].runId` | 该 Prompt 来自哪一次 eval run。 |
| `items[].runLanguage` | 该 run 的原始语言字段。 |
| `items[].modelRequest` | 生成时请求的模型档位，例如 `7b`。 |
| `items[].modelNameReportedByServer` | 生成服务上报的模型名称。 |

## 分数含义

`items[].score` 不是单次 attempt 的分数，而是该样本所有已评分 attempts 的 `weighted_score` 算术平均值，保留 2 位小数。

筛选关系是：

```text
averageWeightedScore >= minScore
```

也就是说，`minScore=8.5` 时，8.5 分会被包含。

## 类别顺序

返回的 `categories` 按固定产品顺序排序：

1. `career`
2. `creation`
3. `family`
4. `life`
5. `role_play`
6. `encyclopedia`
7. `code`
8. `mathematics`

每个类别内部的 `items` 按分数从高到低排序。

## 空结果处理

如果返回：

```json
{
  "categories": [],
  "minScore": 8.5,
  "runId": "some-run-id"
}
```

常见原因：

- `runId` 不存在。
- 该 run 没有带评分的样本。
- 有评分样本，但没有样本达到 `minScore`。
- 不传 `runId` 时，当前语言没有公开可用的 2.9B 数据。

前端应按“暂无推荐 Prompt”处理，不应视为接口异常。

## TypeScript 调用示例

```ts
type HighScorePromptItem = {
  title: string
  prompt: string
  score: number
  runId: string
  runLanguage: string
  modelRequest: string | null
  modelNameReportedByServer: string | null
}

type HighScorePromptCategory = {
  category: string
  categoryDisplayName: string
  averageScore: number
  items: HighScorePromptItem[]
}

type HighScorePromptResponse = {
  categories: HighScorePromptCategory[]
  minScore: number
  runId: string | null
}

async function fetchHighScorePrompts(runId: string) {
  const url = new URL('https://api.rwkv.halowang.cloud/public-api/evals/high-score-samples')
  url.searchParams.set('runId', runId)
  url.searchParams.set('minScore', '8.5')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return (await response.json()) as HighScorePromptResponse
}
```

## 接入建议

1. 需要指定 7.2B 或其他非默认模型版本时，传 `runId`。
2. 需要动态获取可选模型 / run 时，先调用 `/public-api/evals/runs`。
3. 只想按当前界面语种获取默认 2.9B 推荐题时，传 `locale`。
4. 想跟随后台当前推荐阈值时，不传 `minScore`。
5. 想固定阈值时，显式传 `minScore=8.5`。
6. 前端展示时可以读取 `items[].modelNameReportedByServer`，用于调试或标注数据来源。
