import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import type { EvalPassState } from '../types/eval';
import { EvalService } from './eval.service';

@Controller('public-api/evals')
export class EvalPublicController {
  constructor(private readonly evalService: EvalService) {}

  @Get('runs')
  async listRuns() {
    return this.evalService.listRuns();
  }

  @Get('runs/:runId')
  async getRunDetail(@Param('runId') runId: string) {
    return this.evalService.getRunDetail(runId);
  }

  @Get('high-score-languages')
  async getHighScoreLanguages() {
    return this.evalService.getHighScoreLanguages();
  }

  @Get('high-score-samples')
  async getHighScoreSamples(@Query('minScore') rawMinScore?: string) {
    const minScore = rawMinScore !== undefined ? Number.parseFloat(rawMinScore) : undefined;
    return this.evalService.getHighScoreSamples(
      minScore !== undefined && Number.isFinite(minScore) ? minScore : undefined,
    );
  }

  @Get('samples')
  async listSamples(
    @Query('runId') runId?: string,
    @Query('sourceCategory') sourceCategory?: string,
    @Query('search') search?: string,
    @Query('minAverageWeightedScore') rawMinAverageWeightedScore?: string,
    @Query('maxAverageWeightedScore') rawMaxAverageWeightedScore?: string,
    @Query('passState') rawPassState?: string,
    @Query('limit') rawLimit?: string,
    @Query('offset') rawOffset?: string,
    @Query('includeResponses') rawIncludeResponses?: string,
  ) {
    return this.evalService.listSamples({
      runId,
      sourceCategory,
      search,
      minAverageWeightedScore: parseOptionalNumber(rawMinAverageWeightedScore),
      maxAverageWeightedScore: parseOptionalNumber(rawMaxAverageWeightedScore),
      passState: parsePassState(rawPassState),
      limit: parseLimit(rawLimit),
      offset: parseOffset(rawOffset),
      includeResponses: rawIncludeResponses === 'true',
    });
  }

  @Get('samples/:runId/:sampleIndex')
  async getSampleDetail(
    @Param('runId') runId: string,
    @Param('sampleIndex') rawSampleIndex: string,
  ) {
    const sampleIndex = Number.parseInt(rawSampleIndex, 10);
    if (!Number.isInteger(sampleIndex)) {
      throw new NotFoundException('Invalid sample index');
    }
    return this.evalService.getSampleDetail(runId, sampleIndex);
  }
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePassState(value: string | undefined): EvalPassState | undefined {
  if (value === 'passed' || value === 'failed' || value === 'pending') {
    return value;
  }

  return undefined;
}

function parseLimit(value: string | undefined): number | null | undefined {
  if (!value) {
    return undefined;
  }

  if (value.toLowerCase() === 'all') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function parseOffset(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}
