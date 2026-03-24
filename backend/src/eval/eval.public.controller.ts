import { Controller, Get, Query } from '@nestjs/common';
import { EvalService } from './eval.service';

@Controller('public-api/evals')
export class EvalPublicController {
  constructor(private readonly evalService: EvalService) {}

  @Get('runs')
  async listRuns() {
    return this.evalService.listRuns();
  }

  @Get('questions')
  async listQuestions(
    @Query('runId') runId?: string,
    @Query('language') language?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('minAverageScore') rawMinAverageScore?: string,
    @Query('maxAverageScore') rawMaxAverageScore?: string,
    @Query('limit') rawLimit?: string,
  ) {
    const minAverageScore = parseOptionalNumber(rawMinAverageScore);
    const maxAverageScore = parseOptionalNumber(rawMaxAverageScore);
    const limit = parseLimit(rawLimit);

    return this.evalService.listQuestions({
      runId,
      language,
      category,
      search,
      minAverageScore,
      maxAverageScore,
      limit,
    });
  }
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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
