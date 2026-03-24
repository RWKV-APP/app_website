import { Request } from 'express';

export interface EvalSampleAttemptInput {
  attempt?: number;
  status?: string;
  started_at?: string;
  ended_at?: string;
  duration_ms?: number;
  response_chars?: number;
  response?: string;
  score?: number;
  score_note?: string;
  error_type?: string;
  error_message?: string;
  error_body?: string;
}

export interface EvalSampleUploadInput {
  run_id?: string;
  language?: string;
  task_type?: string;
  status?: string;
  sample_index?: number;
  display?: string;
  prompt?: string;
  source_file?: string;
  source_category_name?: string;
  source_category_index?: number;
  source_item_index?: number;
  base_url?: string;
  endpoint?: string;
  model_request?: string;
  model_name_reported_by_server?: string;
  max_tokens?: number;
  repeat_count_target?: number;
  repeat_count_done?: number;
  score_status?: string;
  started_at?: string;
  updated_at?: string;
  average_score?: number;
  scored_at?: string;
  attempts?: EvalSampleAttemptInput[];
  eval_device_label?: string;
  eval_device_chip?: string;
  device_label?: string;
  device_chip?: string;
  device?: unknown;
}

export interface EvalManifestUploadInput {
  run_id?: string;
  status?: string;
  score_status?: string;
  created_at?: string;
  updated_at?: string;
  base_url?: string;
  endpoint?: string;
  task_type?: string;
  language?: string;
  source_file?: string;
  model_request?: string;
  model_name_reported_by_server?: string;
  selection_mode?: string;
  source_total_items?: number;
  sample_count_requested?: number;
  repeat_count?: number;
  max_tokens?: number;
  seed?: number;
  total_samples?: number;
  completed_samples?: number;
  running_samples?: number;
  partial_samples?: number;
  error_samples?: number;
  pending_samples?: number;
  done_attempts?: number;
  total_attempts?: number;
  samples_dir?: string;
  eval_device_label?: string;
  eval_device_chip?: string;
  device_label?: string;
  device_chip?: string;
  device?: unknown;
}

export interface EvalUploadRequest extends Request {
  adminUser?: string;
}

export interface EvalQuestionAttemptSummary {
  id: number;
  attempt: number;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  responseChars: number | null;
  response: string | null;
  score: number | null;
  scoreNote: string | null;
  errorType: string | null;
  errorMessage: string | null;
  errorBody: string | null;
}

export interface EvalQuestionSummary {
  runId: string;
  language: string;
  taskType: string;
  sampleIndex: number;
  sampleStatus: string;
  scoreStatus: string;
  display: string;
  prompt: string;
  sourceFile: string;
  sourceCategoryName: string | null;
  sourceCategoryIndex: number | null;
  sourceItemIndex: number | null;
  baseUrl: string | null;
  endpoint: string;
  modelRequest: string | null;
  modelNameReportedByServer: string | null;
  evalDeviceLabel: string | null;
  evalDeviceChip: string | null;
  maxTokens: number | null;
  repeatCountTarget: number | null;
  repeatCountDone: number | null;
  sampleAverageScore: number | null;
  sampleStartedAt: string | null;
  sampleUpdatedAt: string | null;
  sampleScoredAt: string | null;
  attemptCount: number;
  scoredAttemptCount: number;
  attempts: EvalQuestionAttemptSummary[];
}

export interface EvalRunSummary {
  runId: string;
  language: string;
  taskType: string;
  modelNameReportedByServer: string | null;
  evalDeviceLabel: string | null;
  evalDeviceChip: string | null;
  questionCount: number;
  attemptCount: number;
  scoredQuestionCount: number;
  averageOfAverageScores: number | null;
  categories: string[];
  latestSampleUpdatedAt: string | null;
  latestUploadedAt: string | null;
}

export interface EvalImportSampleResult {
  fileName: string;
  kind: 'sample' | 'manifest';
  runId: string | null;
  sampleIndex: number | null;
  attemptCount: number;
  averageScore: number | null;
  display: string | null;
  sourceCategoryName: string | null;
  evalDeviceLabel: string | null;
  evalDeviceChip: string | null;
  action: 'imported' | 'updated' | 'skipped';
  message: string;
}
