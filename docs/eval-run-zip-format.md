# Eval Run Zip 格式说明

本文档定义当前后台 `/admin-api/evals/upload-run` 期望接收的 eval run zip 结构。

适用场景：

- 向后台导入一整批测评结果
- 让 `/evals` 页面能看到新的 run
- 为后续高分题推荐和公开高分 Prompt API 准备 `scores/` 数据

参考样例：

- 仓库内已有一份真实样例目录：`docs/eval_handoff/remote/evals/2026-03-25_231448_rwkv7-2-9b-g1e-20260312-ctx8192-mlx-6bit-zip/`

## 与公开高分 Prompt API 的关系

`GET /public-api/evals/high-score-samples` 会直接读取导入后的 eval 数据。

这里和公开 Prompt API 直接相关的规则是：

- `items[].score` 对应样本的 `averageWeightedScore`
- `averageWeightedScore` 是同一样本所有已评分 attempt 的 `weighted_score` 算术平均值，保留 2 位小数
- 如果公开接口请求里没有传 `minScore`，后端默认使用当前 `passThreshold` 做筛选阈值；代码默认值是 `8.5`，但后台管理员可以调整
- 如果 zip 里没有 `scores/*.json`，高分推荐和公开 Prompt API 都不会有可用结果

详细的公开接口调用方式见：

- [docs/eval-public-high-score-prompts-api.md](./eval-public-high-score-prompts-api.md)

## 上传约束

- 每次只能上传 `1` 个 `.zip`
- 单个 zip 最大 `64 MB`
- zip 根目录可以直接放文件，也可以外面再包一层总目录
- `__MACOSX` 和 `.DS_Store` 会被忽略
- 路径里不能出现 `..`
- 去掉最外层公共目录后，如果出现重复路径，导入会失败

## 期望目录结构

成功导入至少需要：

- `manifest.json`
- `generation_summary.json`
- 至少一个 `samples/*.json`

`scores/` 不是导入成功的硬性必需项，但如果没有 `scores/*.json`，所有和评分、高分题、推荐题相关的结果都会为空。

推荐结构：

```text
my-run.zip
└── 2026-04-07_my_eval_run/           # 可选：最外层总目录
    ├── manifest.json
    ├── generation_summary.json
    ├── samples/
    │   ├── 0001_completed_en_chat.json
    │   ├── 0002_completed_en_chat.json
    │   └── ...
    └── scores/
        ├── 0001_score.json
        ├── 0002_score.json
        └── ...
```

说明：

- `samples/` 和 `scores/` 下只要是 `.json` 文件都会被读取，文件名本身不是强校验项
- `scores/` 里的 `sample_index` 必须能在 `samples/` 里找到对应样本

## 字段约定

通用约定：

- 所有数字字段都应为 JSON number，不要写成字符串
- 时间字段建议使用 ISO 8601 字符串
- 文本字段应为非空字符串，除非本文档明确写了可选
- 后台只会读取下文列出的关键字段；额外字段允许存在，但不会参与导入逻辑

### 1. `manifest.json`

`manifest.json` 用于描述整个 run 的元信息。

必填字段：

- `run_id`
- `status`
- `endpoint`
- `task_type`
- `language`
- `source_file`
- `source_total_items`
- `sample_count_requested`
- `repeat_count`

可选字段：

- `created_at`
- `updated_at`
- `base_url`
- `model_request`
- `model_name_reported_by_server`
- `selection_mode`
- `max_tokens`
- `seed`
- `eval_device_label`
- `eval_device_cpu`
- `eval_device_gpu`
- `eval_device_memory_gb`
- `eval_device_vram_gb`

最小示例：

```json
{
  "run_id": "2026-04-07_english_eval_run",
  "status": "completed",
  "created_at": "2026-04-07T10:00:00Z",
  "updated_at": "2026-04-07T10:30:00Z",
  "base_url": "http://localhost:8080",
  "endpoint": "http://localhost:8080/v1/chat/completions",
  "task_type": "chat",
  "language": "en",
  "source_file": "docs/requirements/prompt/prebuilt-prompt-en.json",
  "model_request": "rwkv",
  "model_name_reported_by_server": "rwkv7-2.9B-example.zip",
  "selection_mode": "sequential",
  "source_total_items": 340,
  "sample_count_requested": 340,
  "repeat_count": 5,
  "max_tokens": 4000,
  "seed": 20260407,
  "eval_device_label": "MacBook Pro 16-inch",
  "eval_device_cpu": "Apple M4 Pro",
  "eval_device_gpu": "Apple M4 Pro",
  "eval_device_memory_gb": 48,
  "eval_device_vram_gb": null
}
```

补充说明：

- 历史 handoff 文件里常见的 `total_samples`、`done_attempts`、`samples_dir` 等汇总字段可以保留，但当前导入器不会依赖它们
- 最终写入数据库的样本数、attempt 数会以 `samples/*.json` 和 `scores/*.json` 为准重新计算

### 2. `generation_summary.json`

`generation_summary.json` 目前只强依赖很少的字段。

必填字段：

- `run_id`

可选字段：

- `status`
- `latest_completed_sample_index`
- `latest_completed_category`

最小示例：

```json
{
  "run_id": "2026-04-07_english_eval_run",
  "status": "completed",
  "latest_completed_sample_index": 340,
  "latest_completed_category": "mathematics"
}
```

补充说明：

- 如果 `status` 存在，它必须和 `manifest.json.status` 一致
- 其他汇总字段如 `category_stats`、`attempt_stats`、`total_categories` 可以保留，但当前导入器不会使用它们

### 3. `samples/*.json`

每个样本文件表示一个问题及其多次回答尝试。

必填字段：

- `run_id`
- `status`
- `sample_index`
- `rendering_name`
- `prompt`
- `source_file`
- `source_category`
- `source_category_display_name`
- `source_category_index`
- `source_item_index`
- `endpoint`
- `repeat_count_target`
- `repeat_count_done`

可选字段：

- `language`
- `task_type`
- `base_url`
- `model_request`
- `model_name_reported_by_server`
- `max_tokens`
- `started_at`
- `updated_at`
- `eval_device_label`
- `eval_device_cpu`
- `eval_device_gpu`
- `eval_device_memory_gb`
- `eval_device_vram_gb`
- `attempts`

最小示例：

```json
{
  "run_id": "2026-04-07_english_eval_run",
  "language": "en",
  "task_type": "chat",
  "status": "completed",
  "sample_index": 1,
  "rendering_name": "How do I stay motivated when progress feels slow?",
  "prompt": "Please answer in a calm, practical tone and avoid generic motivational clichés.",
  "source_file": "docs/requirements/prompt/prebuilt-prompt-en.json",
  "source_category": "life",
  "source_category_display_name": "Life",
  "source_category_index": 0,
  "source_item_index": 0,
  "base_url": "http://localhost:8080",
  "endpoint": "http://localhost:8080/v1/chat/completions",
  "model_request": "rwkv",
  "model_name_reported_by_server": "rwkv7-2.9B-example.zip",
  "max_tokens": 4000,
  "repeat_count_target": 5,
  "repeat_count_done": 5,
  "started_at": "2026-04-07T10:00:00Z",
  "updated_at": "2026-04-07T10:02:00Z",
  "attempts": [
    {
      "attempt": 1,
      "status": "completed",
      "started_at": "2026-04-07T10:00:00Z",
      "ended_at": "2026-04-07T10:00:10Z",
      "duration_ms": 10000,
      "response_chars": 512,
      "response": "A practical answer...",
      "error_type": null,
      "error_message": null,
      "error_body": null
    }
  ]
}
```

`attempts[]` 内部字段约定：

- `attempt` 必填，且同一个样本内不能重复
- `status` 可选，缺省时后端会按 `completed` 处理
- `started_at`、`ended_at`、`duration_ms`、`response_chars`、`response`、`error_type`、`error_message`、`error_body` 都是可选

补充说明：

- 当前导入器不会强制校验样本文件里的 `language` 和 `task_type`，但建议和 `manifest.json` 保持一致
- 同一个 run 内，`sample_index` 不能重复

### 4. `scores/*.json`

每个评分文件对应一个样本的多次评分结果。

必填字段：

- `sample_index`
- `rendering_name`
- `prompt`
- `source_category`
- `attempt_evals`

`attempt_evals[]` 内部必填字段：

- `attempt`
- `scores.relevance`
- `scores.quality`
- `scores.fluency`
- `scores.satisfaction`
- `weighted_score`

`attempt_evals[]` 内部可选字段：

- `brief_note`

最小示例：

```json
{
  "sample_index": 1,
  "rendering_name": "How do I stay motivated when progress feels slow?",
  "prompt": "Please answer in a calm, practical tone and avoid generic motivational clichés.",
  "source_category": "life",
  "attempt_evals": [
    {
      "attempt": 1,
      "scores": {
        "relevance": 9,
        "quality": 8,
        "fluency": 9,
        "satisfaction": 8
      },
      "weighted_score": 8.35,
      "brief_note": "Helpful and grounded, though still slightly repetitive."
    }
  ]
}
```

补充说明：

- `scores/*.json` 故意不带 `run_id`
- 同一个评分文件内，`attempt` 不能重复
- `rendering_name`、`prompt`、`source_category` 必须和对应的 `samples/*.json` 完全一致，否则导入会失败

## 一致性检查

当前后台会做这些关键校验：

- `generation_summary.json.run_id` 必须等于 `manifest.json.run_id`
- 如果 `generation_summary.json.status` 存在，它必须等于 `manifest.json.status`
- 每个样本文件里的 `run_id` 必须等于 `manifest.json.run_id`
- 同一个 run 内不能出现重复的 `sample_index`
- 同一个样本内不能出现重复的 `attempt`
- 评分文件里的 `attempt` 必须能在对应样本的 `attempts[]` 里找到
- 如果有 `scores/0001_score.json`，那就必须存在对应的样本文件
- 压缩包归一化后的路径不能重复

## 英文 run 的建议约定

如果你要上传的是英文测评，建议至少满足以下约定：

- `manifest.json.language` 写成 `en`
- `samples/*.json` 里的 `language` 也写成 `en`
- `rendering_name`、`prompt`、`source_category_display_name` 使用英文
- `source_file` 指向英文题库来源，而不是继续保留中文题库路径
- `scores/*.json` 里的 `brief_note` 可以直接用英文

## 常见失败原因

- zip 里没有 `manifest.json`
- zip 里没有 `generation_summary.json`
- zip 里没有任何 `samples/*.json`
- `run_id` 前后不一致
- `status` 前后不一致
- `sample_index` 重复
- `attempt` 重复
- `scores/*.json` 引用了不存在的样本或不存在的 attempt
- `rendering_name`、`prompt`、`source_category` 和对应样本不一致
- 打包时混入了多层目录，导致归一化后路径冲突

## 打包前自检清单

- 一个 zip 只放一个 run
- `manifest.json`、`generation_summary.json` 在 zip 根层或唯一外层目录下
- `samples/` 里每个样本都有唯一 `sample_index`
- `repeat_count_done` 和 `attempts[]` 的数量一致
- 如果要做评分展示或高分推荐，确保每个已评分样本都存在对应的 `scores/*.json`
- 英文 run 确认 `language = en`
