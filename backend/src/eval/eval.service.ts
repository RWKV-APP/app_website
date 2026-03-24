import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, type EvalAttempt, type EvalRunMetadata } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  EvalManifestUploadInput,
  EvalImportSampleResult,
  EvalQuestionAttemptSummary,
  EvalQuestionSummary,
  EvalRunSummary,
  EvalSampleAttemptInput,
  EvalSampleUploadInput,
} from '../types/eval';

type EvalAttemptRow = Pick<
  EvalAttempt,
  | 'id'
  | 'uploadedFileName'
  | 'uploadedBy'
  | 'uploadedAt'
  | 'runId'
  | 'language'
  | 'taskType'
  | 'sampleStatus'
  | 'sampleIndex'
  | 'display'
  | 'prompt'
  | 'sourceFile'
  | 'sourceCategoryName'
  | 'sourceCategoryIndex'
  | 'sourceItemIndex'
  | 'baseUrl'
  | 'endpoint'
  | 'modelRequest'
  | 'modelNameReportedByServer'
  | 'maxTokens'
  | 'repeatCountTarget'
  | 'repeatCountDone'
  | 'scoreStatus'
  | 'sampleStartedAt'
  | 'sampleUpdatedAt'
  | 'sampleAverageScore'
  | 'sampleScoredAt'
  | 'attempt'
  | 'attemptStatus'
  | 'attemptStartedAt'
  | 'attemptEndedAt'
  | 'attemptDurationMs'
  | 'responseChars'
  | 'response'
  | 'score'
  | 'scoreNote'
  | 'errorType'
  | 'errorMessage'
  | 'errorBody'
>;

type EvalRunMetadataRow = Pick<
  EvalRunMetadata,
  | 'runId'
  | 'uploadedAt'
  | 'status'
  | 'scoreStatus'
  | 'runCreatedAt'
  | 'runUpdatedAt'
  | 'baseUrl'
  | 'endpoint'
  | 'taskType'
  | 'language'
  | 'sourceFile'
  | 'modelRequest'
  | 'modelNameReportedByServer'
  | 'selectionMode'
  | 'sourceTotalItems'
  | 'sampleCountRequested'
  | 'repeatCount'
  | 'maxTokens'
  | 'seed'
  | 'totalSamples'
  | 'completedSamples'
  | 'runningSamples'
  | 'partialSamples'
  | 'errorSamples'
  | 'pendingSamples'
  | 'doneAttempts'
  | 'totalAttempts'
  | 'samplesDir'
  | 'evalDeviceLabel'
  | 'evalDeviceChip'
>;

interface NormalizedEvalAttempt {
  attempt: number;
  attemptStatus: string;
  attemptStartedAt: Date | null;
  attemptEndedAt: Date | null;
  attemptDurationMs: number | null;
  responseChars: number | null;
  response: string | null;
  score: number | null;
  scoreNote: string | null;
  errorType: string | null;
  errorMessage: string | null;
  errorBody: string | null;
}

interface NormalizedEvalSample {
  runId: string;
  language: string;
  taskType: string;
  sampleStatus: string;
  sampleIndex: number;
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
  maxTokens: number | null;
  repeatCountTarget: number | null;
  repeatCountDone: number | null;
  scoreStatus: string;
  sampleStartedAt: Date | null;
  sampleUpdatedAt: Date | null;
  sampleAverageScore: number | null;
  sampleScoredAt: Date | null;
  attempts: NormalizedEvalAttempt[];
}

interface NormalizedEvalManifest {
  runId: string;
  status: string | null;
  scoreStatus: string | null;
  runCreatedAt: Date | null;
  runUpdatedAt: Date | null;
  baseUrl: string | null;
  endpoint: string | null;
  taskType: string | null;
  language: string | null;
  sourceFile: string | null;
  modelRequest: string | null;
  modelNameReportedByServer: string | null;
  selectionMode: string | null;
  sourceTotalItems: number | null;
  sampleCountRequested: number | null;
  repeatCount: number | null;
  maxTokens: number | null;
  seed: number | null;
  totalSamples: number | null;
  completedSamples: number | null;
  runningSamples: number | null;
  partialSamples: number | null;
  errorSamples: number | null;
  pendingSamples: number | null;
  doneAttempts: number | null;
  totalAttempts: number | null;
  samplesDir: string | null;
  evalDeviceLabel: string | null;
  evalDeviceChip: string | null;
}

interface ListQuestionsOptions {
  runId?: string;
  language?: string;
  category?: string;
  search?: string;
  minAverageScore?: number;
  maxAverageScore?: number;
  limit?: number | null;
}

interface ImportEvalSampleOptions {
  fileName: string;
  content: string;
  uploadedBy: string;
  deviceLabel?: string;
  deviceChip?: string;
}

const evalAttemptSelect = {
  id: true,
  uploadedFileName: true,
  uploadedBy: true,
  uploadedAt: true,
  runId: true,
  language: true,
  taskType: true,
  sampleStatus: true,
  sampleIndex: true,
  display: true,
  prompt: true,
  sourceFile: true,
  sourceCategoryName: true,
  sourceCategoryIndex: true,
  sourceItemIndex: true,
  baseUrl: true,
  endpoint: true,
  modelRequest: true,
  modelNameReportedByServer: true,
  maxTokens: true,
  repeatCountTarget: true,
  repeatCountDone: true,
  scoreStatus: true,
  sampleStartedAt: true,
  sampleUpdatedAt: true,
  sampleAverageScore: true,
  sampleScoredAt: true,
  attempt: true,
  attemptStatus: true,
  attemptStartedAt: true,
  attemptEndedAt: true,
  attemptDurationMs: true,
  responseChars: true,
  response: true,
  score: true,
  scoreNote: true,
  errorType: true,
  errorMessage: true,
  errorBody: true,
} satisfies Prisma.EvalAttemptSelect;

const evalRunMetadataSelect = {
  runId: true,
  uploadedAt: true,
  status: true,
  scoreStatus: true,
  runCreatedAt: true,
  runUpdatedAt: true,
  baseUrl: true,
  endpoint: true,
  taskType: true,
  language: true,
  sourceFile: true,
  modelRequest: true,
  modelNameReportedByServer: true,
  selectionMode: true,
  sourceTotalItems: true,
  sampleCountRequested: true,
  repeatCount: true,
  maxTokens: true,
  seed: true,
  totalSamples: true,
  completedSamples: true,
  runningSamples: true,
  partialSamples: true,
  errorSamples: true,
  pendingSamples: true,
  doneAttempts: true,
  totalAttempts: true,
  samplesDir: true,
  evalDeviceLabel: true,
  evalDeviceChip: true,
} satisfies Prisma.EvalRunMetadataSelect;

@Injectable()
export class EvalService {
  constructor(private readonly prisma: PrismaService) {}

  async importEvalFile(input: ImportEvalSampleOptions): Promise<EvalImportSampleResult> {
    const root = this.parseUploadRoot(input.content);

    if (this.isEvalSamplePayload(root)) {
      return this.importEvalSample(input, root as EvalSampleUploadInput);
    }

    return this.importEvalManifest(input, root as EvalManifestUploadInput);
  }

  private async importEvalSample(
    input: ImportEvalSampleOptions,
    payload: EvalSampleUploadInput,
  ): Promise<EvalImportSampleResult> {
    const normalized = this.parseEvalSample(payload);
    const deviceInfo = this.resolveEvalDeviceInfo(
      payload as Record<string, unknown> & { device?: unknown },
      input,
    );

    if (normalized.attempts.length === 0) {
      await this.upsertRunMetadata(
        this.prisma,
        normalized.runId,
        {
          language: normalized.language,
          taskType: normalized.taskType,
          baseUrl: normalized.baseUrl,
          endpoint: normalized.endpoint,
          sourceFile: normalized.sourceFile,
          modelRequest: normalized.modelRequest,
          modelNameReportedByServer: normalized.modelNameReportedByServer,
          maxTokens: normalized.maxTokens,
          evalDeviceLabel: deviceInfo.evalDeviceLabel,
          evalDeviceChip: deviceInfo.evalDeviceChip,
        },
        input,
      );

      return {
        fileName: input.fileName,
        kind: 'sample',
        runId: normalized.runId,
        sampleIndex: normalized.sampleIndex,
        attemptCount: 0,
        averageScore: normalized.sampleAverageScore,
        display: normalized.display,
        sourceCategoryName: normalized.sourceCategoryName,
        evalDeviceLabel: deviceInfo.evalDeviceLabel,
        evalDeviceChip: deviceInfo.evalDeviceChip,
        action: 'skipped',
        message: 'No attempts found in sample JSON, skipped.',
      };
    }

    const action = await this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.evalAttempt.count({
        where: {
          runId: normalized.runId,
          sampleIndex: normalized.sampleIndex,
        },
      });

      await tx.evalAttempt.deleteMany({
        where: {
          runId: normalized.runId,
          sampleIndex: normalized.sampleIndex,
        },
      });

      await tx.evalAttempt.createMany({
        data: normalized.attempts.map((attempt) => ({
          uploadedFileName: input.fileName,
          uploadedBy: input.uploadedBy,
          runId: normalized.runId,
          language: normalized.language,
          taskType: normalized.taskType,
          sampleStatus: normalized.sampleStatus,
          sampleIndex: normalized.sampleIndex,
          display: normalized.display,
          prompt: normalized.prompt,
          sourceFile: normalized.sourceFile,
          sourceCategoryName: normalized.sourceCategoryName,
          sourceCategoryIndex: normalized.sourceCategoryIndex,
          sourceItemIndex: normalized.sourceItemIndex,
          baseUrl: normalized.baseUrl,
          endpoint: normalized.endpoint,
          modelRequest: normalized.modelRequest,
          modelNameReportedByServer: normalized.modelNameReportedByServer,
          maxTokens: normalized.maxTokens,
          repeatCountTarget: normalized.repeatCountTarget,
          repeatCountDone: normalized.repeatCountDone,
          scoreStatus: normalized.scoreStatus,
          sampleStartedAt: normalized.sampleStartedAt,
          sampleUpdatedAt: normalized.sampleUpdatedAt,
          sampleAverageScore: normalized.sampleAverageScore,
          sampleScoredAt: normalized.sampleScoredAt,
          attempt: attempt.attempt,
          attemptStatus: attempt.attemptStatus,
          attemptStartedAt: attempt.attemptStartedAt,
          attemptEndedAt: attempt.attemptEndedAt,
          attemptDurationMs: attempt.attemptDurationMs,
          responseChars: attempt.responseChars,
          response: attempt.response,
          score: attempt.score,
          scoreNote: attempt.scoreNote,
          errorType: attempt.errorType,
          errorMessage: attempt.errorMessage,
          errorBody: attempt.errorBody,
        })),
      });

      await this.upsertRunMetadata(
        tx,
        normalized.runId,
        {
          language: normalized.language,
          taskType: normalized.taskType,
          baseUrl: normalized.baseUrl,
          endpoint: normalized.endpoint,
          sourceFile: normalized.sourceFile,
          modelRequest: normalized.modelRequest,
          modelNameReportedByServer: normalized.modelNameReportedByServer,
          maxTokens: normalized.maxTokens,
          repeatCount: normalized.repeatCountTarget,
          evalDeviceLabel: deviceInfo.evalDeviceLabel,
          evalDeviceChip: deviceInfo.evalDeviceChip,
        },
        input,
      );

      return existingCount > 0 ? 'updated' : 'imported';
    });

    return {
      fileName: input.fileName,
      kind: 'sample',
      runId: normalized.runId,
      sampleIndex: normalized.sampleIndex,
      attemptCount: normalized.attempts.length,
      averageScore: normalized.sampleAverageScore ?? this.computeAverageScore(normalized.attempts),
      display: normalized.display,
      sourceCategoryName: normalized.sourceCategoryName,
      evalDeviceLabel: deviceInfo.evalDeviceLabel,
      evalDeviceChip: deviceInfo.evalDeviceChip,
      action,
      message:
        action === 'updated'
          ? 'Existing sample attempts were replaced with the uploaded content.'
          : 'Sample imported successfully.',
    };
  }

  private async importEvalManifest(
    input: ImportEvalSampleOptions,
    payload: EvalManifestUploadInput,
  ): Promise<EvalImportSampleResult> {
    const normalized = this.parseEvalManifest(payload, input);
    const existing = await this.prisma.evalRunMetadata.findUnique({
      where: { runId: normalized.runId },
      select: { runId: true },
    });

    await this.upsertRunMetadata(
      this.prisma,
      normalized.runId,
      {
        status: normalized.status,
        scoreStatus: normalized.scoreStatus,
        runCreatedAt: normalized.runCreatedAt,
        runUpdatedAt: normalized.runUpdatedAt,
        baseUrl: normalized.baseUrl,
        endpoint: normalized.endpoint,
        taskType: normalized.taskType,
        language: normalized.language,
        sourceFile: normalized.sourceFile,
        modelRequest: normalized.modelRequest,
        modelNameReportedByServer: normalized.modelNameReportedByServer,
        selectionMode: normalized.selectionMode,
        sourceTotalItems: normalized.sourceTotalItems,
        sampleCountRequested: normalized.sampleCountRequested,
        repeatCount: normalized.repeatCount,
        maxTokens: normalized.maxTokens,
        seed: normalized.seed,
        totalSamples: normalized.totalSamples,
        completedSamples: normalized.completedSamples,
        runningSamples: normalized.runningSamples,
        partialSamples: normalized.partialSamples,
        errorSamples: normalized.errorSamples,
        pendingSamples: normalized.pendingSamples,
        doneAttempts: normalized.doneAttempts,
        totalAttempts: normalized.totalAttempts,
        samplesDir: normalized.samplesDir,
        evalDeviceLabel: normalized.evalDeviceLabel,
        evalDeviceChip: normalized.evalDeviceChip,
      },
      input,
    );

    return {
      fileName: input.fileName,
      kind: 'manifest',
      runId: normalized.runId,
      sampleIndex: null,
      attemptCount: 0,
      averageScore: null,
      display: null,
      sourceCategoryName: null,
      evalDeviceLabel: normalized.evalDeviceLabel,
      evalDeviceChip: normalized.evalDeviceChip,
      action: existing ? 'updated' : 'imported',
      message: existing
        ? 'Run manifest metadata updated successfully.'
        : 'Run manifest metadata imported successfully.',
    };
  }

  async listRuns(): Promise<EvalRunSummary[]> {
    const [rows, runMetadataRows] = await Promise.all([
      this.prisma.evalAttempt.findMany({
        select: evalAttemptSelect,
        orderBy: [{ runId: 'desc' }, { sampleIndex: 'asc' }, { attempt: 'asc' }],
      }),
      this.prisma.evalRunMetadata.findMany({
        select: evalRunMetadataSelect,
        orderBy: [{ runUpdatedAt: 'desc' }, { uploadedAt: 'desc' }],
      }),
    ]);

    const questions = this.buildQuestionSummaries(rows, false);
    const runMetadataByRunId = new Map(runMetadataRows.map((row) => [row.runId, row]));
    const runs = new Map<string, EvalRunSummary & { scoreSum: number; scoreCount: number }>();

    for (const question of questions) {
      const existing = runs.get(question.runId);
      const runMetadata = runMetadataByRunId.get(question.runId);
      const latestSampleUpdatedAt = maxIsoTimestamp(
        question.sampleUpdatedAt,
        toIsoString(runMetadata?.runUpdatedAt ?? null),
      );
      const latestUploadedAt =
        maxIsoTimestamp(
          toIsoString(
            rows.find(
              (row) => row.runId === question.runId && row.sampleIndex === question.sampleIndex,
            )?.uploadedAt ?? null,
          ),
          toIsoString(runMetadata?.uploadedAt ?? null),
        ) || null;

      if (!existing) {
        const initial = {
          runId: question.runId,
          language: runMetadata?.language || question.language,
          taskType: runMetadata?.taskType || question.taskType,
          modelNameReportedByServer:
            runMetadata?.modelNameReportedByServer || question.modelNameReportedByServer,
          evalDeviceLabel: runMetadata?.evalDeviceLabel || null,
          evalDeviceChip: runMetadata?.evalDeviceChip || null,
          questionCount: 1,
          attemptCount: question.attemptCount,
          scoredQuestionCount: question.sampleAverageScore !== null ? 1 : 0,
          averageOfAverageScores: null,
          categories: question.sourceCategoryName ? [question.sourceCategoryName] : [],
          latestSampleUpdatedAt,
          latestUploadedAt,
          scoreSum: question.sampleAverageScore ?? 0,
          scoreCount: question.sampleAverageScore !== null ? 1 : 0,
        };
        runs.set(question.runId, initial);
        continue;
      }

      existing.questionCount += 1;
      existing.attemptCount += question.attemptCount;
      if (question.sampleAverageScore !== null) {
        existing.scoredQuestionCount += 1;
        existing.scoreSum += question.sampleAverageScore;
        existing.scoreCount += 1;
      }
      if (
        question.sourceCategoryName &&
        !existing.categories.includes(question.sourceCategoryName)
      ) {
        existing.categories.push(question.sourceCategoryName);
      }
      if (
        latestSampleUpdatedAt &&
        (!existing.latestSampleUpdatedAt || latestSampleUpdatedAt > existing.latestSampleUpdatedAt)
      ) {
        existing.latestSampleUpdatedAt = latestSampleUpdatedAt;
      }
      if (
        latestUploadedAt &&
        (!existing.latestUploadedAt || latestUploadedAt > existing.latestUploadedAt)
      ) {
        existing.latestUploadedAt = latestUploadedAt;
      }
      existing.evalDeviceLabel = existing.evalDeviceLabel || runMetadata?.evalDeviceLabel || null;
      existing.evalDeviceChip = existing.evalDeviceChip || runMetadata?.evalDeviceChip || null;
      existing.modelNameReportedByServer =
        existing.modelNameReportedByServer || runMetadata?.modelNameReportedByServer || null;
      existing.language = existing.language || runMetadata?.language || question.language;
      existing.taskType = existing.taskType || runMetadata?.taskType || question.taskType;
    }

    for (const metadata of runMetadataRows) {
      if (runs.has(metadata.runId)) {
        continue;
      }

      runs.set(metadata.runId, {
        runId: metadata.runId,
        language: metadata.language || 'unknown',
        taskType: metadata.taskType || 'unknown',
        modelNameReportedByServer: metadata.modelNameReportedByServer || null,
        evalDeviceLabel: metadata.evalDeviceLabel || null,
        evalDeviceChip: metadata.evalDeviceChip || null,
        questionCount: 0,
        attemptCount: 0,
        scoredQuestionCount: 0,
        averageOfAverageScores: null,
        categories: [],
        latestSampleUpdatedAt: toIsoString(metadata.runUpdatedAt),
        latestUploadedAt: toIsoString(metadata.uploadedAt),
        scoreSum: 0,
        scoreCount: 0,
      });
    }

    return [...runs.values()]
      .map((run) => ({
        runId: run.runId,
        language: run.language,
        taskType: run.taskType,
        modelNameReportedByServer: run.modelNameReportedByServer,
        evalDeviceLabel: run.evalDeviceLabel,
        evalDeviceChip: run.evalDeviceChip,
        questionCount: run.questionCount,
        attemptCount: run.attemptCount,
        scoredQuestionCount: run.scoredQuestionCount,
        averageOfAverageScores:
          run.scoreCount > 0 ? roundToTwo(run.scoreSum / run.scoreCount) : null,
        categories: [...run.categories].sort((left, right) => left.localeCompare(right)),
        latestSampleUpdatedAt: run.latestSampleUpdatedAt,
        latestUploadedAt: run.latestUploadedAt,
      }))
      .sort((left, right) => {
        const leftTime = left.latestUploadedAt || left.latestSampleUpdatedAt || left.runId;
        const rightTime = right.latestUploadedAt || right.latestSampleUpdatedAt || right.runId;
        return rightTime.localeCompare(leftTime);
      });
  }

  async listQuestions(options: ListQuestionsOptions): Promise<{
    items: EvalQuestionSummary[];
    total: number;
    availableCategories: string[];
  }> {
    const where = this.buildWhereInput(options);
    const [rows, categoryRows] = await Promise.all([
      this.prisma.evalAttempt.findMany({
        where,
        select: evalAttemptSelect,
        orderBy: [{ runId: 'desc' }, { sampleIndex: 'asc' }, { attempt: 'asc' }],
      }),
      this.prisma.evalAttempt.findMany({
        where: {
          ...where,
          sourceCategoryName: { not: null },
        },
        select: {
          sourceCategoryName: true,
        },
        distinct: ['sourceCategoryName'],
        orderBy: {
          sourceCategoryName: 'asc',
        },
      }),
    ]);

    const runIds = [...new Set(rows.map((row) => row.runId))];
    if (options.runId && !runIds.includes(options.runId)) {
      runIds.push(options.runId);
    }
    const runMetadataRows = runIds.length
      ? await this.prisma.evalRunMetadata.findMany({
          where: { runId: { in: runIds } },
          select: evalRunMetadataSelect,
        })
      : [];
    const runMetadataByRunId = new Map(runMetadataRows.map((row) => [row.runId, row]));

    const grouped = this.buildQuestionSummaries(rows, true)
      .map((question) =>
        this.mergeQuestionWithRunMetadata(question, runMetadataByRunId.get(question.runId)),
      )
      .filter((question) => {
        if (
          options.minAverageScore !== undefined &&
          (question.sampleAverageScore === null ||
            question.sampleAverageScore < options.minAverageScore)
        ) {
          return false;
        }
        if (
          options.maxAverageScore !== undefined &&
          (question.sampleAverageScore === null ||
            question.sampleAverageScore > options.maxAverageScore)
        ) {
          return false;
        }
        return true;
      });

    const randomized = this.randomizeQuestionsWithinScoreBuckets(grouped);
    const total = randomized.length;
    const limit = options.limit === null ? null : clampInt(options.limit, 1, 5000, 24);

    return {
      items: limit === null ? randomized : randomized.slice(0, limit),
      total,
      availableCategories: categoryRows
        .map((row) => row.sourceCategoryName)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    };
  }

  private buildWhereInput(options: ListQuestionsOptions): Prisma.EvalAttemptWhereInput {
    const where: Prisma.EvalAttemptWhereInput = {};

    if (options.runId) {
      where.runId = options.runId;
    }
    if (options.language) {
      where.language = options.language;
    }
    if (options.category) {
      where.sourceCategoryName = options.category;
    }
    if (options.search) {
      where.OR = [
        { display: { contains: options.search } },
        { prompt: { contains: options.search } },
      ];
    }

    return where;
  }

  private buildQuestionSummaries(
    rows: EvalAttemptRow[],
    includeAttempts: boolean,
  ): EvalQuestionSummary[] {
    const grouped = new Map<string, EvalQuestionSummary>();

    for (const row of rows) {
      const key = `${row.runId}::${row.sampleIndex}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          runId: row.runId,
          language: row.language,
          taskType: row.taskType,
          sampleIndex: row.sampleIndex,
          sampleStatus: row.sampleStatus,
          scoreStatus: row.scoreStatus,
          display: row.display,
          prompt: row.prompt,
          sourceFile: row.sourceFile,
          sourceCategoryName: row.sourceCategoryName,
          sourceCategoryIndex: row.sourceCategoryIndex,
          sourceItemIndex: row.sourceItemIndex,
          baseUrl: row.baseUrl,
          endpoint: row.endpoint,
          modelRequest: row.modelRequest,
          modelNameReportedByServer: row.modelNameReportedByServer,
          evalDeviceLabel: null,
          evalDeviceChip: null,
          maxTokens: row.maxTokens,
          repeatCountTarget: row.repeatCountTarget,
          repeatCountDone: row.repeatCountDone,
          sampleAverageScore:
            row.sampleAverageScore !== null
              ? roundToTwo(row.sampleAverageScore)
              : row.score !== null
                ? roundToTwo(row.score)
                : null,
          sampleStartedAt: toIsoString(row.sampleStartedAt),
          sampleUpdatedAt: toIsoString(row.sampleUpdatedAt),
          sampleScoredAt: toIsoString(row.sampleScoredAt),
          attemptCount: 0,
          scoredAttemptCount: 0,
          attempts: [],
        });
      }

      const question = grouped.get(key);
      if (!question) {
        continue;
      }

      question.attemptCount += 1;
      if (row.score !== null) {
        question.scoredAttemptCount += 1;
      }
      if (includeAttempts) {
        question.attempts.push(this.toAttemptSummary(row));
      }
    }

    const items = [...grouped.values()].map((question) => {
      if (question.sampleAverageScore === null && question.attempts.length > 0) {
        const average = this.computeAverageScore(
          question.attempts.map((attempt) => ({
            score: attempt.score,
          })),
        );
        question.sampleAverageScore = average;
      }

      question.attempts.sort((left, right) => left.attempt - right.attempt);
      return question;
    });

    return items;
  }

  private mergeQuestionWithRunMetadata(
    question: EvalQuestionSummary,
    runMetadata: EvalRunMetadataRow | undefined,
  ): EvalQuestionSummary {
    if (!runMetadata) {
      return question;
    }

    return {
      ...question,
      language: runMetadata.language || question.language,
      taskType: runMetadata.taskType || question.taskType,
      modelRequest: runMetadata.modelRequest || question.modelRequest,
      modelNameReportedByServer:
        runMetadata.modelNameReportedByServer || question.modelNameReportedByServer,
      evalDeviceLabel: runMetadata.evalDeviceLabel || question.evalDeviceLabel,
      evalDeviceChip: runMetadata.evalDeviceChip || question.evalDeviceChip,
      baseUrl: runMetadata.baseUrl || question.baseUrl,
    };
  }

  private randomizeQuestionsWithinScoreBuckets(
    questions: EvalQuestionSummary[],
  ): EvalQuestionSummary[] {
    const buckets = new Map<number | null, EvalQuestionSummary[]>();

    for (const question of questions) {
      const scoreKey = question.sampleAverageScore;
      const bucket = buckets.get(scoreKey);
      if (bucket) {
        bucket.push(question);
        continue;
      }
      buckets.set(scoreKey, [question]);
    }

    const scoreKeys = [...buckets.keys()].sort((left, right) => {
      if (left === null && right === null) {
        return 0;
      }
      if (left === null) {
        return 1;
      }
      if (right === null) {
        return -1;
      }
      return right - left;
    });

    const randomized: EvalQuestionSummary[] = [];
    for (const scoreKey of scoreKeys) {
      const bucket = [...(buckets.get(scoreKey) || [])];
      this.shuffleInPlace(bucket);
      randomized.push(...bucket);
    }

    return randomized;
  }

  private shuffleInPlace<T>(items: T[]): void {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
  }

  private toAttemptSummary(row: EvalAttemptRow): EvalQuestionAttemptSummary {
    return {
      id: row.id,
      attempt: row.attempt,
      status: row.attemptStatus,
      startedAt: toIsoString(row.attemptStartedAt),
      endedAt: toIsoString(row.attemptEndedAt),
      durationMs: row.attemptDurationMs,
      responseChars: row.responseChars,
      response: row.response,
      score: row.score !== null ? roundToTwo(row.score) : null,
      scoreNote: row.scoreNote,
      errorType: row.errorType,
      errorMessage: row.errorMessage,
      errorBody: row.errorBody,
    };
  }

  private parseUploadRoot(content: string): Record<string, unknown> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON';
      throw new BadRequestException(`Invalid evaluation JSON: ${message}`);
    }

    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new BadRequestException('Evaluation JSON root must be an object');
    }

    return parsed as Record<string, unknown>;
  }

  private isEvalSamplePayload(payload: Record<string, unknown>): boolean {
    return Object.prototype.hasOwnProperty.call(payload, 'sample_index');
  }

  private parseEvalSample(parsed: EvalSampleUploadInput): NormalizedEvalSample {
    const runId = readRequiredString(parsed.run_id, 'run_id');
    const language = readRequiredString(parsed.language, 'language');
    const taskType = readRequiredString(parsed.task_type, 'task_type');
    const sampleStatus = readRequiredString(parsed.status, 'status');
    const sampleIndex = readRequiredInt(parsed.sample_index, 'sample_index');
    const display = readRequiredString(parsed.display, 'display');
    const prompt = readRequiredString(parsed.prompt, 'prompt');
    const sourceFile = readRequiredString(parsed.source_file, 'source_file');
    const endpoint = readRequiredString(parsed.endpoint, 'endpoint');
    const attemptsInput = Array.isArray(parsed.attempts) ? parsed.attempts : [];
    const attempts = attemptsInput.map((attempt, index) =>
      this.parseAttempt(attempt, index, runId, sampleIndex),
    );

    const seenAttempts = new Set<number>();
    for (const attempt of attempts) {
      if (seenAttempts.has(attempt.attempt)) {
        throw new BadRequestException(
          `Duplicate attempt ${attempt.attempt} found for ${runId} sample ${sampleIndex}`,
        );
      }
      seenAttempts.add(attempt.attempt);
    }

    return {
      runId,
      language,
      taskType,
      sampleStatus,
      sampleIndex,
      display,
      prompt,
      sourceFile,
      sourceCategoryName: readOptionalString(parsed.source_category_name),
      sourceCategoryIndex: readOptionalInt(parsed.source_category_index),
      sourceItemIndex: readOptionalInt(parsed.source_item_index),
      baseUrl: readOptionalString(parsed.base_url),
      endpoint,
      modelRequest: readOptionalString(parsed.model_request),
      modelNameReportedByServer: readOptionalString(parsed.model_name_reported_by_server),
      maxTokens: readOptionalInt(parsed.max_tokens),
      repeatCountTarget: readOptionalInt(parsed.repeat_count_target),
      repeatCountDone: readOptionalInt(parsed.repeat_count_done),
      scoreStatus: readOptionalString(parsed.score_status) || 'pending',
      sampleStartedAt: parseOptionalDate(parsed.started_at, 'started_at'),
      sampleUpdatedAt: parseOptionalDate(parsed.updated_at, 'updated_at'),
      sampleAverageScore: readOptionalNumber(parsed.average_score),
      sampleScoredAt: parseOptionalDate(parsed.scored_at, 'scored_at'),
      attempts,
    };
  }

  private parseEvalManifest(
    parsed: EvalManifestUploadInput,
    input: ImportEvalSampleOptions,
  ): NormalizedEvalManifest {
    const deviceInfo = this.resolveEvalDeviceInfo(
      parsed as Record<string, unknown> & { device?: unknown },
      input,
    );

    return {
      runId: readRequiredString(parsed.run_id, 'run_id'),
      status: readOptionalString(parsed.status),
      scoreStatus: readOptionalString(parsed.score_status),
      runCreatedAt: parseOptionalDate(parsed.created_at, 'created_at'),
      runUpdatedAt: parseOptionalDate(parsed.updated_at, 'updated_at'),
      baseUrl: readOptionalString(parsed.base_url),
      endpoint: readOptionalString(parsed.endpoint),
      taskType: readOptionalString(parsed.task_type),
      language: readOptionalString(parsed.language),
      sourceFile: readOptionalString(parsed.source_file),
      modelRequest: readOptionalString(parsed.model_request),
      modelNameReportedByServer: readOptionalString(parsed.model_name_reported_by_server),
      selectionMode: readOptionalString(parsed.selection_mode),
      sourceTotalItems: readOptionalInt(parsed.source_total_items),
      sampleCountRequested: readOptionalInt(parsed.sample_count_requested),
      repeatCount: readOptionalInt(parsed.repeat_count),
      maxTokens: readOptionalInt(parsed.max_tokens),
      seed: readOptionalInt(parsed.seed),
      totalSamples: readOptionalInt(parsed.total_samples),
      completedSamples: readOptionalInt(parsed.completed_samples),
      runningSamples: readOptionalInt(parsed.running_samples),
      partialSamples: readOptionalInt(parsed.partial_samples),
      errorSamples: readOptionalInt(parsed.error_samples),
      pendingSamples: readOptionalInt(parsed.pending_samples),
      doneAttempts: readOptionalInt(parsed.done_attempts),
      totalAttempts: readOptionalInt(parsed.total_attempts),
      samplesDir: readOptionalString(parsed.samples_dir),
      evalDeviceLabel: deviceInfo.evalDeviceLabel,
      evalDeviceChip: deviceInfo.evalDeviceChip,
    };
  }

  private async upsertRunMetadata(
    client: Prisma.TransactionClient | PrismaService,
    runId: string,
    payload: {
      status?: string | null;
      scoreStatus?: string | null;
      runCreatedAt?: Date | null;
      runUpdatedAt?: Date | null;
      baseUrl?: string | null;
      endpoint?: string | null;
      taskType?: string | null;
      language?: string | null;
      sourceFile?: string | null;
      modelRequest?: string | null;
      modelNameReportedByServer?: string | null;
      selectionMode?: string | null;
      sourceTotalItems?: number | null;
      sampleCountRequested?: number | null;
      repeatCount?: number | null;
      maxTokens?: number | null;
      seed?: number | null;
      totalSamples?: number | null;
      completedSamples?: number | null;
      runningSamples?: number | null;
      partialSamples?: number | null;
      errorSamples?: number | null;
      pendingSamples?: number | null;
      doneAttempts?: number | null;
      totalAttempts?: number | null;
      samplesDir?: string | null;
      evalDeviceLabel?: string | null;
      evalDeviceChip?: string | null;
    },
    input: ImportEvalSampleOptions,
  ): Promise<void> {
    const data = omitUndefined({
      uploadedFileName: input.fileName,
      uploadedBy: input.uploadedBy,
      status: payload.status,
      scoreStatus: payload.scoreStatus,
      runCreatedAt: payload.runCreatedAt,
      runUpdatedAt: payload.runUpdatedAt,
      baseUrl: payload.baseUrl,
      endpoint: payload.endpoint,
      taskType: payload.taskType,
      language: payload.language,
      sourceFile: payload.sourceFile,
      modelRequest: payload.modelRequest,
      modelNameReportedByServer: payload.modelNameReportedByServer,
      selectionMode: payload.selectionMode,
      sourceTotalItems: payload.sourceTotalItems,
      sampleCountRequested: payload.sampleCountRequested,
      repeatCount: payload.repeatCount,
      maxTokens: payload.maxTokens,
      seed: payload.seed,
      totalSamples: payload.totalSamples,
      completedSamples: payload.completedSamples,
      runningSamples: payload.runningSamples,
      partialSamples: payload.partialSamples,
      errorSamples: payload.errorSamples,
      pendingSamples: payload.pendingSamples,
      doneAttempts: payload.doneAttempts,
      totalAttempts: payload.totalAttempts,
      samplesDir: payload.samplesDir,
      evalDeviceLabel: payload.evalDeviceLabel,
      evalDeviceChip: payload.evalDeviceChip,
    });

    await client.evalRunMetadata.upsert({
      where: { runId },
      create: {
        runId,
        ...data,
      },
      update: data,
    });
  }

  private resolveEvalDeviceInfo(
    payload: { [key: string]: unknown; device?: unknown },
    input: ImportEvalSampleOptions,
  ): {
    evalDeviceLabel: string | null;
    evalDeviceChip: string | null;
  } {
    const nestedDevice =
      payload.device && typeof payload.device === 'object' && !Array.isArray(payload.device)
        ? (payload.device as Record<string, unknown>)
        : null;

    return {
      evalDeviceLabel:
        readOptionalString(input.deviceLabel) ||
        readOptionalString(payload.eval_device_label) ||
        readOptionalString(payload.device_label) ||
        readOptionalString(payload.device_name) ||
        readOptionalString(payload.hardware_name) ||
        readOptionalString(nestedDevice?.label) ||
        readOptionalString(nestedDevice?.name) ||
        readOptionalString(nestedDevice?.model) ||
        (typeof payload.device === 'string' ? readOptionalString(payload.device) : null),
      evalDeviceChip:
        readOptionalString(input.deviceChip) ||
        readOptionalString(payload.eval_device_chip) ||
        readOptionalString(payload.device_chip) ||
        readOptionalString(payload.chip_name) ||
        readOptionalString(payload.cpu_model) ||
        readOptionalString(payload.chip) ||
        readOptionalString(nestedDevice?.chip) ||
        readOptionalString(nestedDevice?.processor) ||
        readOptionalString(nestedDevice?.cpu),
    };
  }

  private parseAttempt(
    input: EvalSampleAttemptInput,
    index: number,
    runId: string,
    sampleIndex: number,
  ): NormalizedEvalAttempt {
    if (!input || Array.isArray(input) || typeof input !== 'object') {
      throw new BadRequestException(
        `Attempt #${index + 1} for ${runId} sample ${sampleIndex} must be an object`,
      );
    }

    return {
      attempt: readRequiredInt(input.attempt, `attempts[${index}].attempt`),
      attemptStatus: readOptionalString(input.status) || 'completed',
      attemptStartedAt: parseOptionalDate(input.started_at, `attempts[${index}].started_at`),
      attemptEndedAt: parseOptionalDate(input.ended_at, `attempts[${index}].ended_at`),
      attemptDurationMs: readOptionalInt(input.duration_ms),
      responseChars: readOptionalInt(input.response_chars),
      response: readOptionalString(input.response),
      score: readOptionalNumber(input.score),
      scoreNote: readOptionalString(input.score_note),
      errorType: readOptionalString(input.error_type),
      errorMessage: readOptionalString(input.error_message),
      errorBody:
        input.error_body === undefined || input.error_body === null
          ? null
          : typeof input.error_body === 'string'
            ? input.error_body
            : JSON.stringify(input.error_body),
    };
  }

  private computeAverageScore(
    attempts: Array<Pick<NormalizedEvalAttempt | EvalQuestionAttemptSummary, 'score'>>,
  ): number | null {
    const scores = attempts
      .map((attempt) => attempt.score)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));

    if (scores.length === 0) {
      return null;
    }

    return roundToTwo(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }
}

function readRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`Field "${fieldName}" is required`);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readRequiredInt(value: unknown, fieldName: string): number {
  const parsed = readOptionalInt(value);
  if (parsed === null) {
    throw new BadRequestException(`Field "${fieldName}" must be an integer`);
  }
  return parsed;
}

function readOptionalInt(value: unknown, fieldName?: string): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isInteger(parsed)) {
    if (fieldName) {
      throw new BadRequestException(`Field "${fieldName}" must be an integer`);
    }
    return null;
  }
  return parsed;
}

function readOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalDate(value: unknown, fieldName: string): Date | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new BadRequestException(`Field "${fieldName}" must be an ISO datetime string`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Field "${fieldName}" is not a valid datetime`);
  }

  return parsed;
}

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function maxIsoTimestamp(left: string | null, right: string | null): string | null {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return left > right ? left : right;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function omitUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as Partial<T>;
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(Math.trunc(value), min), max);
}
