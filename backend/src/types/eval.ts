import { Request } from 'express';

export type EvalPassState = 'passed' | 'failed' | 'pending';

export interface EvalUploadRequest extends Request {
  adminUser?: string;
}

export interface EvalSettings {
  passThreshold: number;
  highScoreLanguages: string[];
  activeHighScoreRunIds: string[];
}

export interface EvalCategoryOption {
  key: string;
  displayName: string;
}

export interface EvalRunImportResult {
  fileName: string;
  runId: string;
  action: 'imported' | 'updated';
  sampleCount: number;
  attemptCount: number;
  scoredSampleCount: number;
  scoredAttemptCount: number;
  averageWeightedScore: number | null;
  message: string;
}

export interface EvalRunSummary {
  runId: string;
  uploadedFileName: string;
  uploadedBy: string | null;
  uploadedAt: string;
  runCreatedAt: string | null;
  runUpdatedAt: string | null;
  status: string;
  language: string;
  taskType: string;
  baseUrl: string | null;
  endpoint: string;
  sourceFile: string;
  modelRequest: string | null;
  modelNameReportedByServer: string | null;
  judgeProvider: string | null;
  judgeModel: string | null;
  judgeApiBase: string | null;
  selectionMode: string | null;
  sourceTotalItems: number;
  sampleCountRequested: number;
  repeatCount: number;
  maxTokens: number | null;
  seed: number | null;
  totalSamples: number;
  completedSamples: number;
  runningSamples: number;
  partialSamples: number;
  errorSamples: number;
  pendingSamples: number;
  doneAttempts: number;
  totalAttempts: number;
  latestCompletedSampleIndex: number | null;
  latestCompletedCategory: string | null;
  evalDeviceLabel: string | null;
  evalDeviceCpu: string | null;
  evalDeviceGpu: string | null;
  evalDeviceMemoryGb: number | null;
  evalDeviceVramGb: number | null;
  categories: EvalCategoryOption[];
  scoredSampleCount: number;
  scoredAttemptCount: number;
  averageWeightedScore: number | null;
  passedSampleCount: number;
  failedSampleCount: number;
  pendingScoreSampleCount: number;
}

export interface EvalRunCategoryStat {
  key: string;
  displayName: string;
  totalSamples: number;
  completedSamples: number;
  runningSamples: number;
  partialSamples: number;
  errorSamples: number;
  pendingSamples: number;
  doneAttempts: number;
  totalAttempts: number;
  scoredSamples: number;
  scoredAttempts: number;
  averageWeightedScore: number | null;
  passedSamples: number;
  failedSamples: number;
  pendingScoreSamples: number;
}

export interface EvalRunDetail extends EvalRunSummary {
  passThreshold: number;
  categoryStats: EvalRunCategoryStat[];
}

export interface EvalSampleAttemptSummary {
  id: number;
  attempt: number;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  responseChars: number | null;
  response: string | null;
  errorType: string | null;
  errorMessage: string | null;
  errorBody: string | null;
  relevance: number | null;
  quality: number | null;
  fluency: number | null;
  satisfaction: number | null;
  weightedScore: number | null;
  briefNote: string | null;
}

export interface EvalSampleSummary {
  runId: string;
  sampleIndex: number;
  status: string;
  renderingName: string;
  prompt: string;
  sourceFile: string;
  sourceCategory: string;
  sourceCategoryDisplayName: string;
  sourceCategoryIndex: number;
  sourceItemIndex: number;
  baseUrl: string | null;
  endpoint: string;
  modelRequest: string | null;
  modelNameReportedByServer: string | null;
  maxTokens: number | null;
  repeatCountTarget: number;
  repeatCountDone: number;
  sampleStartedAt: string | null;
  sampleUpdatedAt: string | null;
  averageWeightedScore: number | null;
  averageRelevance: number | null;
  averageQuality: number | null;
  averageFluency: number | null;
  averageSatisfaction: number | null;
  scoredAttemptCount: number;
  passState: EvalPassState;
  attempts: EvalSampleAttemptSummary[];
}

export interface EvalSamplesResponse {
  items: EvalSampleSummary[];
  total: number;
  availableCategories: EvalCategoryOption[];
  passThreshold: number;
}

export interface EvalHighScoreSampleItem {
  title: string;
  prompt: string;
  score: number;
  runId: string;
  runLanguage: string;
  modelRequest: string | null;
  modelNameReportedByServer: string | null;
}

export interface EvalHighScoreCategoryGroup {
  category: string;
  categoryDisplayName: string;
  averageScore: number;
  items: EvalHighScoreSampleItem[];
}

export interface EvalHighScoreSamplesResponse {
  categories: EvalHighScoreCategoryGroup[];
  minScore: number;
  runId: string | null;
}
