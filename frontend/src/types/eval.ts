export type EvalPassState = 'passed' | 'failed' | 'pending';

export interface EvalSettingsRecord {
  passThreshold: number;
}

export interface EvalCategoryOptionRecord {
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

export interface EvalRunSummaryRecord {
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
  categories: EvalCategoryOptionRecord[];
  scoredSampleCount: number;
  scoredAttemptCount: number;
  averageWeightedScore: number | null;
  passedSampleCount: number;
  failedSampleCount: number;
  pendingScoreSampleCount: number;
}

export interface EvalRunCategoryStatRecord {
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

export interface EvalRunDetailRecord extends EvalRunSummaryRecord {
  passThreshold: number;
  categoryStats: EvalRunCategoryStatRecord[];
}

export interface EvalSampleAttemptRecord {
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

export interface EvalSampleRecord {
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
  attempts: EvalSampleAttemptRecord[];
}

export interface EvalSamplesResponse {
  items: EvalSampleRecord[];
  total: number;
  availableCategories: EvalCategoryOptionRecord[];
  passThreshold: number;
}
