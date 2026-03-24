export interface EvalImportResult {
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

export interface EvalRunRecord {
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

export interface EvalQuestionAttemptRecord {
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

export interface EvalQuestionRecord {
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
  attempts: EvalQuestionAttemptRecord[];
}

export interface EvalQuestionsResponse {
  items: EvalQuestionRecord[];
  total: number;
  availableCategories: string[];
}
