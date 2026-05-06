# 高分 Prompt API 支持 runId 筛选变更记录

本文记录本次对高分 Prompt 公开 API 的调整目的、实施过程和后续注意事项。

## 背景与目的

线上 eval 数据已经同时存在多个模型版本：

- 7.2B 简体中文：`rwkv7-g1f-7-2b-20260414-zh-fastthink-repeat5-appdefaults`
- 7.2B 英文：`rwkv7-g1f-7-2b-20260414-en-fastthink-repeat5-appdefaults`
- 2.9B 简体中文：`2026-03-25_231448_rwkv7-2-9b-g1e-20260312-ctx8192-mlx-6bit-zip`
- 2.9B 英文：`2026-04-03_105246_rwkv7-2-9b-g1e-20260312-ctx8192-mlx-6bit-zip_multilingual_5lang_en`

原来的 `GET /public-api/evals/high-score-samples` 只按语言和分数阈值筛选。也就是说，当同一个语言同时有 7.2B 和 2.9B 数据时，返回结果会混合多个 eval run。

本次调整的目标是：

- 保留旧调用方式，避免影响已接入方。
- 不新增替代 API 路径；继续使用既有的 `GET /public-api/evals/high-score-samples`。
- 没有传 `runId` 时，默认只返回 2.9B 高分 Prompt，避免旧调用方混入 7.2B 数据。
- 增加 `runId` 精确筛选能力，让调用方可以明确请求 7.2B、2.9B 或任意一次指定 eval run。
- 在返回 item 中附加来源信息，方便前端或调试工具识别 prompt 来自哪个 run 和模型。

## 实施过程

### 1. 后端类型扩展

文件：`backend/src/types/eval.ts`

`EvalHighScoreSampleItem` 新增字段：

- `runId`
- `runLanguage`
- `modelRequest`
- `modelNameReportedByServer`

`EvalHighScoreSamplesResponse` 新增顶层字段：

- `runId`

顶层 `runId` 表示本次请求显式指定的 run；如果调用方没有传 `runId`，返回 `null`。

### 2. Controller 接收 runId

文件：`backend/src/eval/eval.public.controller.ts`

`GET /public-api/evals/high-score-samples` 在原路径不变的前提下新增 query 参数：

```text
runId
```

该参数会传给 `EvalService.getHighScoreSamples`。

### 3. Service 查询逻辑调整

文件：`backend/src/eval/eval.service.ts`

新逻辑：

1. 如果传入 `runId`，只按 `run.runId == runId` 查询。
2. 如果没有传 `runId`，继续使用语言解析逻辑，并额外限制为默认 2.9B run。
3. 查询结果额外读取关联 run 的 `runId`、`language`、`modelRequest`、`modelNameReportedByServer`。
4. 组装 `items[]` 时把这些来源字段一起返回。

这使得接口现在同时支持两种模式：

```text
按语言获取默认 2.9B：
GET /public-api/evals/high-score-samples?locale=en&minScore=8.5

按 run 精确筛选：
GET /public-api/evals/high-score-samples?runId=rwkv7-g1f-7-2b-20260414-en-fastthink-repeat5-appdefaults&minScore=8.5
```

### 4. 公开文档同步

文件：`docs/eval-public-high-score-prompts-api.md`

已补充：

- `runId` 参数说明
- 7.2B 简体中文和英文示例
- 新增返回字段说明
- 不传 `runId` 时默认返回 2.9B
- 传 `runId` 时语言参数不再参与样本来源筛选

## 注意事项

### 向后兼容

旧请求仍然可用：

```text
GET /public-api/evals/high-score-samples?locale=en&minScore=8.5
```

该模式现在会返回对应语言的默认 2.9B 高分 Prompt，不会混入 7.2B。

普通样本列表 `GET /public-api/evals/samples` 不是本次兼容逻辑的目标接口，不传 `runId` 时不会自动限制为 2.9B。

### 推荐接入方式

如果产品明确要展示某个模型版本的高分 Prompt，推荐显式传 `runId`：

```text
GET /public-api/evals/high-score-samples?runId=<RUN_ID>&minScore=8.5
```

不要只用 `locale=en` 来代表英文 7.2B，因为不传 `runId` 时会返回默认 2.9B。

### runId 优先级

传入 `runId` 后，后端会直接按该 run 查询。

此时 `locale`、`language`、`Application-Language`、`Accept-Language` 不再决定样本来源。调用方可以不传语言参数。

### 空结果含义

下面几种情况都会返回空 `categories`：

- `runId` 不存在。
- 该 run 没有任何带评分的样本。
- 该 run 有评分样本，但没有样本达到 `minScore`。
- 不传 `runId` 时，当前语言没有公开可用的 2.9B 数据。

这类结果应按“暂无可展示推荐 Prompt”处理，不应视为接口异常。

### 后续可能的扩展

如果未来需要更宽松的模型筛选，可以在 `runId` 之外增加参数，例如：

- `modelSize=7.2B`
- `modelFamily=rwkv7-g1f`
- `modelName=rwkv7-g1f-7.2b-20260414-ctx8192`

但这些参数都不如 `runId` 精确。当前建议仍以 `runId` 作为面向产品的主筛选方式。
