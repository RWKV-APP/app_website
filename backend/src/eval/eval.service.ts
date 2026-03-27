import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import JSZip = require('jszip');
import { PrismaService } from '../prisma/prisma.service';
import type {
  EvalCategoryOption,
  EvalHighScoreCategoryGroup,
  EvalHighScoreSampleItem,
  EvalHighScoreSamplesResponse,
  EvalPassState,
  EvalRunCategoryStat,
  EvalRunDetail,
  EvalRunImportResult,
  EvalRunSummary,
  EvalSampleAttemptSummary,
  EvalSamplesResponse,
  EvalSampleSummary,
  EvalSettings,
} from '../types/eval';

const DEFAULT_PASS_THRESHOLD = 8.5;
const EVAL_PASS_THRESHOLD_KEY = 'eval.pass_threshold';
const DEFAULT_HIGH_SCORE_LANGUAGES = ['zh-Hans'];
const EVAL_HIGH_SCORE_LANGUAGES_KEY = 'eval.high_score_languages';
const FILE_SIZE_LIMIT_MB = 64;

interface ImportRunArchiveOptions {
  fileName: string;
  buffer: Buffer;
  uploadedBy: string;
}

interface UpdateEvalSettingsInput {
  passThreshold: number;
  highScoreLanguages?: string[];
}

interface ListSamplesOptions {
  runId?: string;
  sourceCategory?: string;
  search?: string;
  minAverageWeightedScore?: number;
  maxAverageWeightedScore?: number;
  passState?: EvalPassState;
  limit?: number | null;
  offset?: number;
  includeResponses?: boolean;
}

interface EvalDeviceInfo {
  label: string | null;
  cpu: string | null;
  gpu: string | null;
  memoryGb: number | null;
  vramGb: number | null;
}

interface ParsedManifest {
  runId: string;
  status: string;
  runCreatedAt: Date | null;
  runUpdatedAt: Date | null;
  baseUrl: string | null;
  endpoint: string;
  taskType: string;
  language: string;
  sourceFile: string;
  modelRequest: string | null;
  modelNameReportedByServer: string | null;
  selectionMode: string | null;
  sourceTotalItems: number;
  sampleCountRequested: number;
  repeatCount: number;
  maxTokens: number | null;
  seed: number | null;
  device: EvalDeviceInfo;
}

interface ParsedGenerationSummary {
  runId: string;
  status: string | null;
  latestCompletedSampleIndex: number | null;
  latestCompletedCategory: string | null;
}

interface ParsedScoreAttempt {
  attempt: number;
  relevance: number;
  quality: number;
  fluency: number;
  satisfaction: number;
  weightedScore: number;
  briefNote: string | null;
}

interface ParsedSampleAttempt {
  attempt: number;
  status: string;
  startedAt: Date | null;
  endedAt: Date | null;
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

interface ParsedSample {
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
  sampleStartedAt: Date | null;
  sampleUpdatedAt: Date | null;
  averageWeightedScore: number | null;
  averageRelevance: number | null;
  averageQuality: number | null;
  averageFluency: number | null;
  averageSatisfaction: number | null;
  scoredAttemptCount: number;
  device: EvalDeviceInfo;
  attempts: ParsedSampleAttempt[];
}

interface ParsedRunBundle {
  run: ParsedManifest & {
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
    device: EvalDeviceInfo;
  };
  samples: ParsedSample[];
}

const runSummarySampleSelect = Prisma.validator<Prisma.EvalSampleSelect>()({
  sampleIndex: true,
  status: true,
  sourceCategory: true,
  sourceCategoryDisplayName: true,
  sourceCategoryIndex: true,
  repeatCountTarget: true,
  repeatCountDone: true,
  averageWeightedScore: true,
  scoredAttemptCount: true,
});

const runWithSummarySamplesInclude = Prisma.validator<Prisma.EvalRunInclude>()({
  samples: {
    select: runSummarySampleSelect,
    orderBy: { sampleIndex: 'asc' },
  },
});

type EvalRunWithSummarySamples = Prisma.EvalRunGetPayload<{
  include: typeof runWithSummarySamplesInclude;
}>;

const sampleAttemptSelect = Prisma.validator<Prisma.EvalSampleAttemptSelect>()({
  id: true,
  attempt: true,
  status: true,
  startedAt: true,
  endedAt: true,
  durationMs: true,
  responseChars: true,
  response: true,
  errorType: true,
  errorMessage: true,
  errorBody: true,
  relevance: true,
  quality: true,
  fluency: true,
  satisfaction: true,
  weightedScore: true,
  briefNote: true,
});

const sampleWithAttemptsInclude = Prisma.validator<Prisma.EvalSampleInclude>()({
  attempts: {
    select: sampleAttemptSelect,
    orderBy: { attempt: 'asc' },
  },
  run: {
    select: {
      runId: true,
    },
  },
});

const sampleAttemptSelectWithoutResponse = Prisma.validator<Prisma.EvalSampleAttemptSelect>()({
  id: true,
  attempt: true,
  status: true,
  startedAt: true,
  endedAt: true,
  durationMs: true,
  responseChars: true,
  errorType: true,
  errorMessage: true,
  errorBody: true,
  relevance: true,
  quality: true,
  fluency: true,
  satisfaction: true,
  weightedScore: true,
  briefNote: true,
});

const sampleWithAttemptsIncludeNoResponse = Prisma.validator<Prisma.EvalSampleInclude>()({
  attempts: {
    select: sampleAttemptSelectWithoutResponse,
    orderBy: { attempt: 'asc' },
  },
  run: {
    select: {
      runId: true,
    },
  },
});

type EvalSampleWithAttemptsNoResponse = Prisma.EvalSampleGetPayload<{
  include: typeof sampleWithAttemptsIncludeNoResponse;
}>;

type EvalSampleWithAttempts = Prisma.EvalSampleGetPayload<{
  include: typeof sampleWithAttemptsInclude;
}>;

@Injectable()
export class EvalService {
  constructor(private readonly prisma: PrismaService) {}

  async importRunArchive(input: ImportRunArchiveOptions): Promise<EvalRunImportResult> {
    const bundle = await this.parseRunArchive(input.fileName, input.buffer);
    const existing = await this.prisma.evalRun.findUnique({
      where: { runId: bundle.run.runId },
      select: { id: true },
    });

    await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.evalRun.delete({
          where: { runId: bundle.run.runId },
        });
      }

      const createdRun = await tx.evalRun.create({
        data: {
          runId: bundle.run.runId,
          uploadedFileName: input.fileName,
          uploadedBy: input.uploadedBy,
          runCreatedAt: bundle.run.runCreatedAt,
          runUpdatedAt: bundle.run.runUpdatedAt,
          status: bundle.run.status,
          language: bundle.run.language,
          taskType: bundle.run.taskType,
          baseUrl: bundle.run.baseUrl,
          endpoint: bundle.run.endpoint,
          sourceFile: bundle.run.sourceFile,
          modelRequest: bundle.run.modelRequest,
          modelNameReportedByServer: bundle.run.modelNameReportedByServer,
          selectionMode: bundle.run.selectionMode,
          sourceTotalItems: bundle.run.sourceTotalItems,
          sampleCountRequested: bundle.run.sampleCountRequested,
          repeatCount: bundle.run.repeatCount,
          maxTokens: bundle.run.maxTokens,
          seed: bundle.run.seed,
          totalSamples: bundle.run.totalSamples,
          completedSamples: bundle.run.completedSamples,
          runningSamples: bundle.run.runningSamples,
          partialSamples: bundle.run.partialSamples,
          errorSamples: bundle.run.errorSamples,
          pendingSamples: bundle.run.pendingSamples,
          doneAttempts: bundle.run.doneAttempts,
          totalAttempts: bundle.run.totalAttempts,
          latestCompletedSampleIndex: bundle.run.latestCompletedSampleIndex,
          latestCompletedCategory: bundle.run.latestCompletedCategory,
          evalDeviceLabel: bundle.run.device.label,
          evalDeviceCpu: bundle.run.device.cpu,
          evalDeviceGpu: bundle.run.device.gpu,
          evalDeviceMemoryGb: bundle.run.device.memoryGb,
          evalDeviceVramGb: bundle.run.device.vramGb,
        },
      });

      for (const sample of bundle.samples) {
        await tx.evalSample.create({
          data: {
            evalRunId: createdRun.id,
            sampleIndex: sample.sampleIndex,
            status: sample.status,
            renderingName: sample.renderingName,
            prompt: sample.prompt,
            sourceFile: sample.sourceFile,
            sourceCategory: sample.sourceCategory,
            sourceCategoryDisplayName: sample.sourceCategoryDisplayName,
            sourceCategoryIndex: sample.sourceCategoryIndex,
            sourceItemIndex: sample.sourceItemIndex,
            baseUrl: sample.baseUrl,
            endpoint: sample.endpoint,
            modelRequest: sample.modelRequest,
            modelNameReportedByServer: sample.modelNameReportedByServer,
            maxTokens: sample.maxTokens,
            repeatCountTarget: sample.repeatCountTarget,
            repeatCountDone: sample.repeatCountDone,
            sampleStartedAt: sample.sampleStartedAt,
            sampleUpdatedAt: sample.sampleUpdatedAt,
            averageWeightedScore: sample.averageWeightedScore,
            averageRelevance: sample.averageRelevance,
            averageQuality: sample.averageQuality,
            averageFluency: sample.averageFluency,
            averageSatisfaction: sample.averageSatisfaction,
            scoredAttemptCount: sample.scoredAttemptCount,
            attempts: {
              create: sample.attempts.map((attempt) => ({
                attempt: attempt.attempt,
                status: attempt.status,
                startedAt: attempt.startedAt,
                endedAt: attempt.endedAt,
                durationMs: attempt.durationMs,
                responseChars: attempt.responseChars,
                response: attempt.response,
                errorType: attempt.errorType,
                errorMessage: attempt.errorMessage,
                errorBody: attempt.errorBody,
                relevance: attempt.relevance,
                quality: attempt.quality,
                fluency: attempt.fluency,
                satisfaction: attempt.satisfaction,
                weightedScore: attempt.weightedScore,
                briefNote: attempt.briefNote,
              })),
            },
          },
        });
      }
    });

    return {
      fileName: input.fileName,
      runId: bundle.run.runId,
      action: existing ? 'updated' : 'imported',
      sampleCount: bundle.samples.length,
      attemptCount: bundle.run.doneAttempts,
      scoredSampleCount: bundle.samples.filter((sample) => sample.averageWeightedScore !== null).length,
      scoredAttemptCount: bundle.samples.reduce(
        (sum, sample) => sum + sample.scoredAttemptCount,
        0,
      ),
      averageWeightedScore: computeAverage(
        bundle.samples
          .map((sample) => sample.averageWeightedScore)
          .filter((value): value is number => value !== null),
      ),
      message: existing
        ? 'Existing run snapshot was replaced successfully.'
        : 'Run archive imported successfully.',
    };
  }

  async getSettings(): Promise<EvalSettings> {
    const [passThreshold, highScoreLanguages] = await Promise.all([
      this.getPassThreshold(),
      this.getHighScoreLanguages(),
    ]);
    return { passThreshold, highScoreLanguages };
  }

  async updateSettings(input: UpdateEvalSettingsInput): Promise<EvalSettings> {
    const passThreshold = normalizePassThreshold(input.passThreshold);
    const ops: Promise<unknown>[] = [
      this.prisma.appConfig.upsert({
        where: { key: EVAL_PASS_THRESHOLD_KEY },
        create: { key: EVAL_PASS_THRESHOLD_KEY, value: String(passThreshold) },
        update: { value: String(passThreshold) },
      }),
    ];

    let highScoreLanguages: string[];
    if (input.highScoreLanguages !== undefined) {
      highScoreLanguages = input.highScoreLanguages;
      ops.push(
        this.prisma.appConfig.upsert({
          where: { key: EVAL_HIGH_SCORE_LANGUAGES_KEY },
          create: { key: EVAL_HIGH_SCORE_LANGUAGES_KEY, value: JSON.stringify(highScoreLanguages) },
          update: { value: JSON.stringify(highScoreLanguages) },
        }),
      );
    } else {
      highScoreLanguages = await this.getHighScoreLanguages();
    }

    await Promise.all(ops);
    return { passThreshold, highScoreLanguages };
  }

  async getHighScoreLanguages(): Promise<string[]> {
    const setting = await this.prisma.appConfig.findUnique({
      where: { key: EVAL_HIGH_SCORE_LANGUAGES_KEY },
      select: { value: true },
    });
    if (!setting) return DEFAULT_HIGH_SCORE_LANGUAGES;
    try {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
        return parsed;
      }
    } catch {
      // fall through
    }
    return DEFAULT_HIGH_SCORE_LANGUAGES;
  }

  async listRuns(): Promise<EvalRunSummary[]> {
    const [passThreshold, runs] = await Promise.all([
      this.getPassThreshold(),
      this.prisma.evalRun.findMany({
        include: runWithSummarySamplesInclude,
        orderBy: [{ uploadedAt: 'desc' }, { runId: 'desc' }],
      }),
    ]);

    return runs.map((run) => this.toRunSummary(run, passThreshold));
  }

  async getRunDetail(runId: string): Promise<EvalRunDetail> {
    const [passThreshold, run] = await Promise.all([
      this.getPassThreshold(),
      this.prisma.evalRun.findUnique({
        where: { runId },
        include: runWithSummarySamplesInclude,
      }),
    ]);

    if (!run) {
      throw new NotFoundException(`Eval run "${runId}" not found`);
    }

    const summary = this.toRunSummary(run, passThreshold);

    return {
      ...summary,
      passThreshold,
      categoryStats: buildCategoryStats(run.samples, passThreshold),
    };
  }

  async listSamples(options: ListSamplesOptions): Promise<EvalSamplesResponse> {
    const passThreshold = await this.getPassThreshold();
    const where = this.buildSampleWhereInput(options, passThreshold);
    const take = options.limit === null ? undefined : clampInt(options.limit, 1, 5000, 36);
    const skip = clampInt(options.offset, 0, 1_000_000, 0);
    const include = options.includeResponses
      ? sampleWithAttemptsInclude
      : sampleWithAttemptsIncludeNoResponse;

    const [total, rows, categoryRows] = await Promise.all([
      this.prisma.evalSample.count({ where }),
      this.prisma.evalSample.findMany({
        where,
        include,
        orderBy: [{ averageWeightedScore: 'desc' }, { sampleIndex: 'asc' }],
        take,
        skip,
      }),
      this.prisma.evalSample.findMany({
        where: this.buildAvailableCategoryWhereInput(options),
        select: {
          sourceCategory: true,
          sourceCategoryDisplayName: true,
          sourceCategoryIndex: true,
        },
        orderBy: [{ sourceCategoryIndex: 'asc' }, { sourceCategory: 'asc' }],
      }),
    ]);

    return {
      items: rows.map((row) => this.toSampleSummary(row, passThreshold)),
      total,
      availableCategories: dedupeCategoryOptions(categoryRows),
      passThreshold,
    };
  }

  async getHighScoreSamples(minScore?: number): Promise<EvalHighScoreSamplesResponse> {
    const threshold = minScore ?? (await this.getPassThreshold());
    const rows = await this.prisma.evalSample.findMany({
      where: { averageWeightedScore: { gte: threshold } },
      select: {
        renderingName: true,
        prompt: true,
        averageWeightedScore: true,
        sourceCategory: true,
        sourceCategoryDisplayName: true,
      },
      orderBy: { averageWeightedScore: 'desc' },
    });

    // Group by category
    const categoryMap = new Map<
      string,
      { displayName: string; scoreSum: number; items: EvalHighScoreSampleItem[] }
    >();
    for (const row of rows) {
      const score = row.averageWeightedScore as number;
      let entry = categoryMap.get(row.sourceCategory);
      if (!entry) {
        entry = { displayName: row.sourceCategoryDisplayName, scoreSum: 0, items: [] };
        categoryMap.set(row.sourceCategory, entry);
      }
      entry.scoreSum += score;
      entry.items.push({ title: row.renderingName, prompt: row.prompt, score });
    }

    // Build sorted categories (desc by average score)
    const categories: EvalHighScoreCategoryGroup[] = Array.from(categoryMap.entries())
      .map(([category, { displayName, scoreSum, items }]) => ({
        category,
        categoryDisplayName: displayName,
        averageScore: Math.round((scoreSum / items.length) * 10000) / 10000,
        items,
      }))
      .sort((a, b) => b.averageScore - a.averageScore);

    return { categories, minScore: threshold };
  }

  async getSampleDetail(runId: string, sampleIndex: number): Promise<EvalSampleSummary> {
    const passThreshold = await this.getPassThreshold();
    const row = await this.prisma.evalSample.findFirst({
      where: {
        sampleIndex,
        run: { is: { runId } },
      },
      include: sampleWithAttemptsInclude,
    });
    if (!row) {
      throw new NotFoundException(`Sample ${sampleIndex} not found in run "${runId}"`);
    }
    return this.toSampleSummary(row, passThreshold);
  }

  private buildSampleWhereInput(
    options: ListSamplesOptions,
    passThreshold: number,
  ): Prisma.EvalSampleWhereInput {
    const clauses: Prisma.EvalSampleWhereInput[] = [];

    if (options.runId) {
      clauses.push({
        run: {
          is: {
            runId: options.runId,
          },
        },
      });
    }

    if (options.sourceCategory) {
      clauses.push({
        sourceCategory: options.sourceCategory,
      });
    }

    if (options.search) {
      clauses.push({
        OR: [
          { renderingName: { contains: options.search } },
          { prompt: { contains: options.search } },
        ],
      });
    }

    if (typeof options.minAverageWeightedScore === 'number') {
      clauses.push({
        averageWeightedScore: {
          gte: options.minAverageWeightedScore,
        },
      });
    }

    if (typeof options.maxAverageWeightedScore === 'number') {
      clauses.push({
        averageWeightedScore: {
          lte: options.maxAverageWeightedScore,
        },
      });
    }

    if (options.passState === 'passed') {
      clauses.push({
        averageWeightedScore: {
          gte: passThreshold,
        },
      });
    }

    if (options.passState === 'failed') {
      clauses.push({
        AND: [
          {
            averageWeightedScore: {
              not: null,
            },
          },
          {
            averageWeightedScore: {
              lt: passThreshold,
            },
          },
        ],
      });
    }

    if (options.passState === 'pending') {
      clauses.push({
        averageWeightedScore: null,
      });
    }

    if (clauses.length === 0) {
      return {};
    }

    return {
      AND: clauses,
    };
  }

  private buildAvailableCategoryWhereInput(options: ListSamplesOptions): Prisma.EvalSampleWhereInput {
    if (!options.runId) {
      return {};
    }

    return {
      run: {
        is: {
          runId: options.runId,
        },
      },
    };
  }

  private toRunSummary(run: EvalRunWithSummarySamples, passThreshold: number): EvalRunSummary {
    const scoreAverages = run.samples
      .map((sample) => sample.averageWeightedScore)
      .filter((value): value is number => value !== null);

    const scoredSampleCount = run.samples.filter(
      (sample) => sample.averageWeightedScore !== null,
    ).length;
    const scoredAttemptCount = run.samples.reduce(
      (sum, sample) => sum + sample.scoredAttemptCount,
      0,
    );
    const passedSampleCount = run.samples.filter(
      (sample) => getPassState(sample.averageWeightedScore, passThreshold) === 'passed',
    ).length;
    const failedSampleCount = run.samples.filter(
      (sample) => getPassState(sample.averageWeightedScore, passThreshold) === 'failed',
    ).length;
    const pendingScoreSampleCount = run.samples.filter(
      (sample) => getPassState(sample.averageWeightedScore, passThreshold) === 'pending',
    ).length;

    return {
      runId: run.runId,
      uploadedFileName: run.uploadedFileName,
      uploadedBy: run.uploadedBy ?? null,
      uploadedAt: toIsoString(run.uploadedAt),
      runCreatedAt: toIsoString(run.runCreatedAt),
      runUpdatedAt: toIsoString(run.runUpdatedAt),
      status: run.status,
      language: run.language,
      taskType: run.taskType,
      baseUrl: run.baseUrl ?? null,
      endpoint: run.endpoint,
      sourceFile: run.sourceFile,
      modelRequest: run.modelRequest ?? null,
      modelNameReportedByServer: run.modelNameReportedByServer ?? null,
      selectionMode: run.selectionMode ?? null,
      sourceTotalItems: run.sourceTotalItems,
      sampleCountRequested: run.sampleCountRequested,
      repeatCount: run.repeatCount,
      maxTokens: run.maxTokens ?? null,
      seed: run.seed ?? null,
      totalSamples: run.totalSamples,
      completedSamples: run.completedSamples,
      runningSamples: run.runningSamples,
      partialSamples: run.partialSamples,
      errorSamples: run.errorSamples,
      pendingSamples: run.pendingSamples,
      doneAttempts: run.doneAttempts,
      totalAttempts: run.totalAttempts,
      latestCompletedSampleIndex: run.latestCompletedSampleIndex ?? null,
      latestCompletedCategory: run.latestCompletedCategory ?? null,
      evalDeviceLabel: run.evalDeviceLabel ?? null,
      evalDeviceCpu: run.evalDeviceCpu ?? null,
      evalDeviceGpu: run.evalDeviceGpu ?? null,
      evalDeviceMemoryGb: nullableRoundToTwo(run.evalDeviceMemoryGb),
      evalDeviceVramGb: nullableRoundToTwo(run.evalDeviceVramGb),
      categories: buildCategoryOptions(run.samples),
      scoredSampleCount,
      scoredAttemptCount,
      averageWeightedScore: computeAverage(scoreAverages),
      passedSampleCount,
      failedSampleCount,
      pendingScoreSampleCount,
    };
  }

  private toSampleSummary(row: EvalSampleWithAttempts | EvalSampleWithAttemptsNoResponse, passThreshold: number): EvalSampleSummary {
    return {
      runId: row.run.runId,
      sampleIndex: row.sampleIndex,
      status: row.status,
      renderingName: row.renderingName,
      prompt: row.prompt,
      sourceFile: row.sourceFile,
      sourceCategory: row.sourceCategory,
      sourceCategoryDisplayName: row.sourceCategoryDisplayName,
      sourceCategoryIndex: row.sourceCategoryIndex,
      sourceItemIndex: row.sourceItemIndex,
      baseUrl: row.baseUrl ?? null,
      endpoint: row.endpoint,
      modelRequest: row.modelRequest ?? null,
      modelNameReportedByServer: row.modelNameReportedByServer ?? null,
      maxTokens: row.maxTokens ?? null,
      repeatCountTarget: row.repeatCountTarget,
      repeatCountDone: row.repeatCountDone,
      sampleStartedAt: toIsoString(row.sampleStartedAt),
      sampleUpdatedAt: toIsoString(row.sampleUpdatedAt),
      averageWeightedScore: nullableRoundToTwo(row.averageWeightedScore),
      averageRelevance: nullableRoundToTwo(row.averageRelevance),
      averageQuality: nullableRoundToTwo(row.averageQuality),
      averageFluency: nullableRoundToTwo(row.averageFluency),
      averageSatisfaction: nullableRoundToTwo(row.averageSatisfaction),
      scoredAttemptCount: row.scoredAttemptCount,
      passState: getPassState(row.averageWeightedScore, passThreshold),
      attempts: row.attempts.map(this.toAttemptSummary),
    };
  }

  private toAttemptSummary(attempt: Prisma.EvalSampleAttemptGetPayload<{
    select: typeof sampleAttemptSelect;
  }> | Prisma.EvalSampleAttemptGetPayload<{
    select: typeof sampleAttemptSelectWithoutResponse;
  }>): EvalSampleAttemptSummary {
    return {
      id: attempt.id,
      attempt: attempt.attempt,
      status: attempt.status,
      startedAt: toIsoString(attempt.startedAt),
      endedAt: toIsoString(attempt.endedAt),
      durationMs: attempt.durationMs ?? null,
      responseChars: attempt.responseChars ?? null,
      response: ('response' in attempt ? attempt.response : null) ?? null,
      errorType: attempt.errorType ?? null,
      errorMessage: attempt.errorMessage ?? null,
      errorBody: attempt.errorBody ?? null,
      relevance: attempt.relevance ?? null,
      quality: attempt.quality ?? null,
      fluency: attempt.fluency ?? null,
      satisfaction: attempt.satisfaction ?? null,
      weightedScore: nullableRoundToTwo(attempt.weightedScore),
      briefNote: attempt.briefNote ?? null,
    };
  }

  private async getPassThreshold(): Promise<number> {
    const setting = await this.prisma.appConfig.findUnique({
      where: { key: EVAL_PASS_THRESHOLD_KEY },
      select: { value: true },
    });

    if (!setting) {
      return DEFAULT_PASS_THRESHOLD;
    }

    const parsed = Number.parseFloat(setting.value);
    return Number.isFinite(parsed) ? normalizePassThreshold(parsed) : DEFAULT_PASS_THRESHOLD;
  }

  private async parseRunArchive(fileName: string, buffer: Buffer): Promise<ParsedRunBundle> {
    if (buffer.length === 0) {
      throw new BadRequestException('Uploaded archive is empty.');
    }

    const maxSize = FILE_SIZE_LIMIT_MB * 1024 * 1024;
    if (buffer.length > maxSize) {
      throw new BadRequestException(`Archive is larger than ${FILE_SIZE_LIMIT_MB} MB.`);
    }

    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid ZIP archive';
      throw new BadRequestException(`Failed to read ZIP archive: ${message}`);
    }

    const archiveFiles = normalizeArchiveFiles(zip);
    const manifestPath = 'manifest.json';
    const generationSummaryPath = 'generation_summary.json';
    const manifestEntry = archiveFiles.get(manifestPath);
    const generationSummaryEntry = archiveFiles.get(generationSummaryPath);

    if (!manifestEntry) {
      throw new BadRequestException('Run archive must include manifest.json.');
    }
    if (!generationSummaryEntry) {
      throw new BadRequestException('Run archive must include generation_summary.json.');
    }

    const sampleEntries = [...archiveFiles.entries()]
      .filter(([path]) => path.startsWith('samples/') && path.endsWith('.json'))
      .sort(([left], [right]) => left.localeCompare(right));

    if (sampleEntries.length === 0) {
      throw new BadRequestException('Run archive must include at least one samples/*.json file.');
    }

    const scoreEntries = [...archiveFiles.entries()]
      .filter(([path]) => path.startsWith('scores/') && path.endsWith('.json'))
      .sort(([left], [right]) => left.localeCompare(right));

    const manifest = this.parseManifest(
      await readZipJson(manifestEntry, manifestPath),
      manifestPath,
    );
    const generationSummary = this.parseGenerationSummary(
      await readZipJson(generationSummaryEntry, generationSummaryPath),
      generationSummaryPath,
    );

    if (generationSummary.runId !== manifest.runId) {
      throw new BadRequestException(
        `generation_summary.json run_id "${generationSummary.runId}" does not match manifest run_id "${manifest.runId}".`,
      );
    }

    if (generationSummary.status && generationSummary.status !== manifest.status) {
      throw new BadRequestException(
        `generation_summary.json status "${generationSummary.status}" does not match manifest status "${manifest.status}".`,
      );
    }

    const scoreMap = new Map<number, { path: string; scores: ParsedScoreAttempt[]; metadata: Record<string, string | number | null> }>();
    for (const [path, entry] of scoreEntries) {
      const parsed = this.parseScoreFile(await readZipJson(entry, path), path, manifest.runId);
      if (scoreMap.has(parsed.sampleIndex)) {
        throw new BadRequestException(
          `Duplicate score file found for sample ${parsed.sampleIndex}: ${path}`,
        );
      }
      scoreMap.set(parsed.sampleIndex, {
        path,
        scores: parsed.attempts,
        metadata: {
          renderingName: parsed.renderingName,
          prompt: parsed.prompt,
          sourceCategory: parsed.sourceCategory,
        },
      });
    }

    const samples: ParsedSample[] = [];
    const seenSampleIndexes = new Set<number>();

    for (const [path, entry] of sampleEntries) {
      const sample = this.parseSampleFile(await readZipJson(entry, path), path, manifest.runId);
      if (seenSampleIndexes.has(sample.sampleIndex)) {
        throw new BadRequestException(`Duplicate sample_index ${sample.sampleIndex} found in ${path}.`);
      }
      seenSampleIndexes.add(sample.sampleIndex);

      const scoreBundle = scoreMap.get(sample.sampleIndex);
      if (scoreBundle) {
        validateScoreMetadata(scoreBundle.metadata, sample, scoreBundle.path);
        applyScoresToSample(sample, scoreBundle.scores, scoreBundle.path);
      }

      finalizeSampleAverages(sample);
      samples.push(sample);
    }

    for (const sampleIndex of scoreMap.keys()) {
      if (!seenSampleIndexes.has(sampleIndex)) {
        throw new BadRequestException(
          `Score file exists for sample ${sampleIndex}, but samples/*.json is missing.`,
        );
      }
    }

    const computedCounts = summarizeSampleStatuses(samples);
    const latestCompletedFallback = getLatestCompletedSampleInfo(samples);
    const runDevice = mergeDeviceInfo(manifest.device, samples[0]?.device || emptyDeviceInfo());

    return {
      run: {
        ...manifest,
        totalSamples: samples.length,
        completedSamples: computedCounts.completedSamples,
        runningSamples: computedCounts.runningSamples,
        partialSamples: computedCounts.partialSamples,
        errorSamples: computedCounts.errorSamples,
        pendingSamples: computedCounts.pendingSamples,
        doneAttempts: computedCounts.doneAttempts,
        totalAttempts: computedCounts.totalAttempts,
        latestCompletedSampleIndex:
          generationSummary.latestCompletedSampleIndex ?? latestCompletedFallback.sampleIndex,
        latestCompletedCategory:
          generationSummary.latestCompletedCategory ?? latestCompletedFallback.sourceCategory,
        device: runDevice,
      },
      samples,
    };
  }

  private parseManifest(raw: unknown, path: string): ParsedManifest {
    const payload = readObject(raw, path);

    return {
      runId: readRequiredString(payload.run_id, `${path}.run_id`),
      status: readRequiredString(payload.status, `${path}.status`),
      runCreatedAt: parseOptionalDate(payload.created_at, `${path}.created_at`),
      runUpdatedAt: parseOptionalDate(payload.updated_at, `${path}.updated_at`),
      baseUrl: readOptionalString(payload.base_url),
      endpoint: readRequiredString(payload.endpoint, `${path}.endpoint`),
      taskType: readRequiredString(payload.task_type, `${path}.task_type`),
      language: readRequiredString(payload.language, `${path}.language`),
      sourceFile: readRequiredString(payload.source_file, `${path}.source_file`),
      modelRequest: readOptionalString(payload.model_request),
      modelNameReportedByServer: readOptionalString(payload.model_name_reported_by_server),
      selectionMode: readOptionalString(payload.selection_mode),
      sourceTotalItems: readRequiredInt(payload.source_total_items, `${path}.source_total_items`),
      sampleCountRequested: readRequiredInt(
        payload.sample_count_requested,
        `${path}.sample_count_requested`,
      ),
      repeatCount: readRequiredInt(payload.repeat_count, `${path}.repeat_count`),
      maxTokens: readOptionalInt(payload.max_tokens),
      seed: readOptionalInt(payload.seed),
      device: parseDeviceInfo(payload),
    };
  }

  private parseGenerationSummary(raw: unknown, path: string): ParsedGenerationSummary {
    const payload = readObject(raw, path);

    return {
      runId: readRequiredString(payload.run_id, `${path}.run_id`),
      status: readOptionalString(payload.status),
      latestCompletedSampleIndex: readOptionalInt(payload.latest_completed_sample_index),
      latestCompletedCategory: readOptionalString(payload.latest_completed_category),
    };
  }

  private parseSampleFile(raw: unknown, path: string, expectedRunId: string): ParsedSample {
    const payload = readObject(raw, path);
    const runId = readRequiredString(payload.run_id, `${path}.run_id`);

    if (runId !== expectedRunId) {
      throw new BadRequestException(
        `${path} run_id "${runId}" does not match manifest run_id "${expectedRunId}".`,
      );
    }

    const sampleIndex = readRequiredInt(payload.sample_index, `${path}.sample_index`);
    const attemptsInput = Array.isArray(payload.attempts) ? payload.attempts : [];
    const seenAttempts = new Set<number>();
    const attempts = attemptsInput.map((entry, index) => {
      const attempt = this.parseSampleAttempt(entry, `${path}.attempts[${index}]`);
      if (seenAttempts.has(attempt.attempt)) {
        throw new BadRequestException(
          `Duplicate attempt ${attempt.attempt} found in ${path}.`,
        );
      }
      seenAttempts.add(attempt.attempt);
      return attempt;
    });

    return {
      sampleIndex,
      status: readRequiredString(payload.status, `${path}.status`),
      renderingName: readRequiredString(payload.rendering_name, `${path}.rendering_name`),
      prompt: readRequiredString(payload.prompt, `${path}.prompt`),
      sourceFile: readRequiredString(payload.source_file, `${path}.source_file`),
      sourceCategory: readRequiredString(payload.source_category, `${path}.source_category`),
      sourceCategoryDisplayName: readRequiredString(
        payload.source_category_display_name,
        `${path}.source_category_display_name`,
      ),
      sourceCategoryIndex: readRequiredInt(
        payload.source_category_index,
        `${path}.source_category_index`,
      ),
      sourceItemIndex: readRequiredInt(payload.source_item_index, `${path}.source_item_index`),
      baseUrl: readOptionalString(payload.base_url),
      endpoint: readRequiredString(payload.endpoint, `${path}.endpoint`),
      modelRequest: readOptionalString(payload.model_request),
      modelNameReportedByServer: readOptionalString(payload.model_name_reported_by_server),
      maxTokens: readOptionalInt(payload.max_tokens),
      repeatCountTarget: readRequiredInt(payload.repeat_count_target, `${path}.repeat_count_target`),
      repeatCountDone: readRequiredInt(payload.repeat_count_done, `${path}.repeat_count_done`),
      sampleStartedAt: parseOptionalDate(payload.started_at, `${path}.started_at`),
      sampleUpdatedAt: parseOptionalDate(payload.updated_at, `${path}.updated_at`),
      averageWeightedScore: null,
      averageRelevance: null,
      averageQuality: null,
      averageFluency: null,
      averageSatisfaction: null,
      scoredAttemptCount: 0,
      device: parseDeviceInfo(payload),
      attempts,
    };
  }

  private parseSampleAttempt(raw: unknown, path: string): ParsedSampleAttempt {
    const payload = readObject(raw, path);

    return {
      attempt: readRequiredInt(payload.attempt, `${path}.attempt`),
      status: readOptionalString(payload.status) || 'completed',
      startedAt: parseOptionalDate(payload.started_at, `${path}.started_at`),
      endedAt: parseOptionalDate(payload.ended_at, `${path}.ended_at`),
      durationMs: readOptionalInt(payload.duration_ms),
      responseChars: readOptionalInt(payload.response_chars),
      response: readOptionalString(payload.response),
      errorType: readOptionalString(payload.error_type),
      errorMessage: readOptionalString(payload.error_message),
      errorBody: stringifyNullableValue(payload.error_body),
      relevance: null,
      quality: null,
      fluency: null,
      satisfaction: null,
      weightedScore: null,
      briefNote: null,
    };
  }

  private parseScoreFile(
    raw: unknown,
    path: string,
    expectedRunId: string,
  ): {
    sampleIndex: number;
    renderingName: string;
    prompt: string;
    sourceCategory: string;
    attempts: ParsedScoreAttempt[];
  } {
    const payload = readObject(raw, path);
    const sampleIndex = readRequiredInt(payload.sample_index, `${path}.sample_index`);
    const attemptsInput = Array.isArray(payload.attempt_evals) ? payload.attempt_evals : [];
    const seenAttempts = new Set<number>();

    const attempts = attemptsInput.map((entry, index) => {
      const evalPayload = readObject(entry, `${path}.attempt_evals[${index}]`);
      const attempt = readRequiredInt(evalPayload.attempt, `${path}.attempt_evals[${index}].attempt`);
      if (seenAttempts.has(attempt)) {
        throw new BadRequestException(
          `Duplicate score attempt ${attempt} found in ${path}.`,
        );
      }
      seenAttempts.add(attempt);

      const scores = readObject(
        evalPayload.scores,
        `${path}.attempt_evals[${index}].scores`,
      );

      return {
        attempt,
        relevance: readRequiredInt(scores.relevance, `${path}.scores.relevance`),
        quality: readRequiredInt(scores.quality, `${path}.scores.quality`),
        fluency: readRequiredInt(scores.fluency, `${path}.scores.fluency`),
        satisfaction: readRequiredInt(scores.satisfaction, `${path}.scores.satisfaction`),
        weightedScore: readRequiredNumber(
          evalPayload.weighted_score,
          `${path}.attempt_evals[${index}].weighted_score`,
        ),
        briefNote: readOptionalString(evalPayload.brief_note),
      };
    });

    // expectedRunId is unused in score files on purpose: they do not carry run_id.
    void expectedRunId;

    return {
      sampleIndex,
      renderingName: readRequiredString(payload.rendering_name, `${path}.rendering_name`),
      prompt: readRequiredString(payload.prompt, `${path}.prompt`),
      sourceCategory: readRequiredString(payload.source_category, `${path}.source_category`),
      attempts,
    };
  }
}

function normalizeArchiveFiles(zip: JSZip): Map<string, JSZip.JSZipObject> {
  const rawEntries = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => ({
      entry,
      path: normalizeArchivePath(entry.name),
    }))
    .filter((item): item is { entry: JSZip.JSZipObject; path: string } => item.path !== null);

  if (rawEntries.length === 0) {
    throw new BadRequestException('Run archive does not contain any readable files.');
  }

  const allNestedUnderSingleRoot =
    rawEntries.every((item) => item.path.includes('/')) &&
    new Set(rawEntries.map((item) => item.path.split('/')[0])).size === 1;

  const archiveFiles = new Map<string, JSZip.JSZipObject>();
  for (const item of rawEntries) {
    const normalizedPath = allNestedUnderSingleRoot
      ? item.path.split('/').slice(1).join('/')
      : item.path;

    if (!normalizedPath) {
      continue;
    }

    if (archiveFiles.has(normalizedPath)) {
      throw new BadRequestException(`Archive contains duplicate path "${normalizedPath}".`);
    }

    archiveFiles.set(normalizedPath, item.entry);
  }

  return archiveFiles;
}

function normalizeArchivePath(rawPath: string): string | null {
  const withForwardSlashes = rawPath.replace(/\\/g, '/').replace(/^\.\/+/, '');
  const segments = withForwardSlashes.split('/').filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  if (segments.some((segment) => segment === '..')) {
    throw new BadRequestException(`Archive path "${rawPath}" is not allowed.`);
  }

  if (segments[0] === '__MACOSX') {
    return null;
  }

  const lastSegment = segments[segments.length - 1];
  if (lastSegment === '.DS_Store') {
    return null;
  }

  return segments.join('/');
}

async function readZipJson(entry: JSZip.JSZipObject, path: string): Promise<unknown> {
  const content = await entry.async('string');
  try {
    return JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    throw new BadRequestException(`Failed to parse ${path}: ${message}`);
  }
}

function parseDeviceInfo(payload: Record<string, unknown>): EvalDeviceInfo {
  return {
    label: readOptionalString(payload.eval_device_label),
    cpu: readOptionalString(payload.eval_device_cpu),
    gpu: readOptionalString(payload.eval_device_gpu),
    memoryGb: readOptionalNumber(payload.eval_device_memory_gb),
    vramGb: readOptionalNumber(payload.eval_device_vram_gb),
  };
}

function mergeDeviceInfo(primary: EvalDeviceInfo, fallback: EvalDeviceInfo): EvalDeviceInfo {
  return {
    label: primary.label || fallback.label,
    cpu: primary.cpu || fallback.cpu,
    gpu: primary.gpu || fallback.gpu,
    memoryGb: primary.memoryGb ?? fallback.memoryGb,
    vramGb: primary.vramGb ?? fallback.vramGb,
  };
}

function emptyDeviceInfo(): EvalDeviceInfo {
  return {
    label: null,
    cpu: null,
    gpu: null,
    memoryGb: null,
    vramGb: null,
  };
}

function validateScoreMetadata(
  metadata: Record<string, string | number | null>,
  sample: ParsedSample,
  path: string,
): void {
  if (metadata.renderingName !== sample.renderingName) {
    throw new BadRequestException(
      `${path} rendering_name does not match sample ${sample.sampleIndex}.`,
    );
  }
  if (metadata.prompt !== sample.prompt) {
    throw new BadRequestException(`${path} prompt does not match sample ${sample.sampleIndex}.`);
  }
  if (metadata.sourceCategory !== sample.sourceCategory) {
    throw new BadRequestException(
      `${path} source_category does not match sample ${sample.sampleIndex}.`,
    );
  }
}

function applyScoresToSample(
  sample: ParsedSample,
  scores: ParsedScoreAttempt[],
  path: string,
): void {
  const attemptMap = new Map(sample.attempts.map((attempt) => [attempt.attempt, attempt]));

  for (const score of scores) {
    const target = attemptMap.get(score.attempt);
    if (!target) {
      throw new BadRequestException(
        `${path} references attempt ${score.attempt}, but sample ${sample.sampleIndex} does not contain it.`,
      );
    }

    target.relevance = score.relevance;
    target.quality = score.quality;
    target.fluency = score.fluency;
    target.satisfaction = score.satisfaction;
    target.weightedScore = roundToTwo(score.weightedScore);
    target.briefNote = score.briefNote;
  }
}

function finalizeSampleAverages(sample: ParsedSample): void {
  const scoredAttempts = sample.attempts.filter((attempt) => attempt.weightedScore !== null);
  sample.scoredAttemptCount = scoredAttempts.length;

  if (scoredAttempts.length === 0) {
    sample.averageWeightedScore = null;
    sample.averageRelevance = null;
    sample.averageQuality = null;
    sample.averageFluency = null;
    sample.averageSatisfaction = null;
    return;
  }

  sample.averageWeightedScore = computeAverage(
    scoredAttempts
      .map((attempt) => attempt.weightedScore)
      .filter((value): value is number => value !== null),
  );
  sample.averageRelevance = computeAverage(
    scoredAttempts
      .map((attempt) => attempt.relevance)
      .filter((value): value is number => value !== null),
  );
  sample.averageQuality = computeAverage(
    scoredAttempts
      .map((attempt) => attempt.quality)
      .filter((value): value is number => value !== null),
  );
  sample.averageFluency = computeAverage(
    scoredAttempts
      .map((attempt) => attempt.fluency)
      .filter((value): value is number => value !== null),
  );
  sample.averageSatisfaction = computeAverage(
    scoredAttempts
      .map((attempt) => attempt.satisfaction)
      .filter((value): value is number => value !== null),
  );
}

function summarizeSampleStatuses(samples: ParsedSample[]): {
  completedSamples: number;
  runningSamples: number;
  partialSamples: number;
  errorSamples: number;
  pendingSamples: number;
  doneAttempts: number;
  totalAttempts: number;
} {
  const summary = {
    completedSamples: 0,
    runningSamples: 0,
    partialSamples: 0,
    errorSamples: 0,
    pendingSamples: 0,
    doneAttempts: 0,
    totalAttempts: 0,
  };

  for (const sample of samples) {
    if (sample.status === 'completed') {
      summary.completedSamples += 1;
    } else if (sample.status === 'running') {
      summary.runningSamples += 1;
    } else if (sample.status === 'partial') {
      summary.partialSamples += 1;
    } else if (sample.status === 'error') {
      summary.errorSamples += 1;
    } else {
      summary.pendingSamples += 1;
    }

    summary.doneAttempts += sample.repeatCountDone;
    summary.totalAttempts += sample.repeatCountTarget;
  }

  return summary;
}

function getLatestCompletedSampleInfo(samples: ParsedSample[]): {
  sampleIndex: number | null;
  sourceCategory: string | null;
} {
  const completedSamples = samples
    .filter((sample) => sample.status === 'completed')
    .sort((left, right) => right.sampleIndex - left.sampleIndex);

  if (completedSamples.length === 0) {
    return {
      sampleIndex: null,
      sourceCategory: null,
    };
  }

  return {
    sampleIndex: completedSamples[0].sampleIndex,
    sourceCategory: completedSamples[0].sourceCategory,
  };
}

function buildCategoryOptions(
  samples: Array<{
    sourceCategory: string;
    sourceCategoryDisplayName: string;
    sourceCategoryIndex: number;
  }>,
): EvalCategoryOption[] {
  return dedupeCategoryOptions(samples);
}

function dedupeCategoryOptions(
  categories: Array<{
    sourceCategory: string;
    sourceCategoryDisplayName: string;
    sourceCategoryIndex?: number | null;
  }>,
): EvalCategoryOption[] {
  const categoryMap = new Map<
    string,
    { key: string; displayName: string; index: number }
  >();

  for (const category of categories) {
    const existing = categoryMap.get(category.sourceCategory);
    const nextIndex =
      typeof category.sourceCategoryIndex === 'number' ? category.sourceCategoryIndex : Number.MAX_SAFE_INTEGER;

    if (!existing || nextIndex < existing.index) {
      categoryMap.set(category.sourceCategory, {
        key: category.sourceCategory,
        displayName: category.sourceCategoryDisplayName,
        index: nextIndex,
      });
    }
  }

  return [...categoryMap.values()]
    .sort((left, right) => {
      if (left.index !== right.index) {
        return left.index - right.index;
      }
      return left.key.localeCompare(right.key);
    })
    .map(({ key, displayName }) => ({ key, displayName }));
}

function buildCategoryStats(
  samples: Array<{
    status: string;
    sourceCategory: string;
    sourceCategoryDisplayName: string;
    sourceCategoryIndex: number;
    repeatCountTarget: number;
    repeatCountDone: number;
    averageWeightedScore: number | null;
    scoredAttemptCount: number;
  }>,
  passThreshold: number,
): EvalRunCategoryStat[] {
  const categoryMap = new Map<
    string,
    EvalRunCategoryStat & { sourceCategoryIndex: number; scoreValues: number[] }
  >();

  for (const sample of samples) {
    let bucket = categoryMap.get(sample.sourceCategory);
    if (!bucket) {
      bucket = {
        key: sample.sourceCategory,
        displayName: sample.sourceCategoryDisplayName,
        totalSamples: 0,
        completedSamples: 0,
        runningSamples: 0,
        partialSamples: 0,
        errorSamples: 0,
        pendingSamples: 0,
        doneAttempts: 0,
        totalAttempts: 0,
        scoredSamples: 0,
        scoredAttempts: 0,
        averageWeightedScore: null,
        passedSamples: 0,
        failedSamples: 0,
        pendingScoreSamples: 0,
        sourceCategoryIndex: sample.sourceCategoryIndex,
        scoreValues: [],
      };
      categoryMap.set(sample.sourceCategory, bucket);
    }

    bucket.totalSamples += 1;
    bucket.doneAttempts += sample.repeatCountDone;
    bucket.totalAttempts += sample.repeatCountTarget;
    bucket.scoredAttempts += sample.scoredAttemptCount;

    if (sample.status === 'completed') {
      bucket.completedSamples += 1;
    } else if (sample.status === 'running') {
      bucket.runningSamples += 1;
    } else if (sample.status === 'partial') {
      bucket.partialSamples += 1;
    } else if (sample.status === 'error') {
      bucket.errorSamples += 1;
    } else {
      bucket.pendingSamples += 1;
    }

    const passState = getPassState(sample.averageWeightedScore, passThreshold);
    if (passState === 'passed') {
      bucket.passedSamples += 1;
    } else if (passState === 'failed') {
      bucket.failedSamples += 1;
    } else {
      bucket.pendingScoreSamples += 1;
    }

    if (sample.averageWeightedScore !== null) {
      bucket.scoredSamples += 1;
      bucket.scoreValues.push(sample.averageWeightedScore);
    }
  }

  return [...categoryMap.values()]
    .sort((left, right) => {
      if (left.sourceCategoryIndex !== right.sourceCategoryIndex) {
        return left.sourceCategoryIndex - right.sourceCategoryIndex;
      }
      return left.key.localeCompare(right.key);
    })
    .map(({ scoreValues, sourceCategoryIndex, ...rest }) => ({
      ...rest,
      averageWeightedScore: computeAverage(scoreValues),
    }));
}

function getPassState(
  averageWeightedScore: number | null,
  passThreshold: number,
): EvalPassState {
  if (averageWeightedScore === null) {
    return 'pending';
  }

  return averageWeightedScore >= passThreshold ? 'passed' : 'failed';
}

function computeAverage(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return roundToTwo(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function normalizePassThreshold(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 10) {
    throw new BadRequestException('passThreshold must be a finite number between 0 and 10.');
  }

  return roundToTwo(value);
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function nullableRoundToTwo(value: number | null | undefined): number | null {
  return typeof value === 'number' ? roundToTwo(value) : null;
}

function toIsoString(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function clampInt(
  value: number | null | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!Number.isInteger(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function readObject(value: unknown, fieldName: string): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new BadRequestException(`${fieldName} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`Field "${fieldName}" is required.`);
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
    throw new BadRequestException(`Field "${fieldName}" must be an integer.`);
  }

  return parsed;
}

function readOptionalInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isInteger(parsed) ? parsed : null;
  }

  return null;
}

function readRequiredNumber(value: unknown, fieldName: string): number {
  const parsed = readOptionalNumber(value);
  if (parsed === null) {
    throw new BadRequestException(`Field "${fieldName}" must be a number.`);
  }

  return parsed;
}

function readOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseOptionalDate(value: unknown, fieldName: string): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(`Field "${fieldName}" must be an ISO date string.`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Field "${fieldName}" is not a valid date.`);
  }

  return parsed;
}

function stringifyNullableValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
