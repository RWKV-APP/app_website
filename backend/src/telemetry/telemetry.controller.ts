import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import type { Request } from 'express';

@Controller('public-api/telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('perf')
  @HttpCode(200)
  async uploadPerf(@Body() body: any, @Req() req: Request) {
    return this.telemetryService.ingest(body, req.ip ?? null);
  }

  @Get('leaderboard')
  async leaderboard(
    @Query('socName') socName?: string,
    @Query('modelSha256') modelSha256?: string,
    @Query('backend') backend?: string,
    @Query('os') os?: string,
    @Query('isBatch') isBatch?: string,
    @Query('appVersion') appVersion?: string,
    @Query('limit') limit?: string,
  ) {
    return this.telemetryService.leaderboard({ socName, modelSha256, backend, os, isBatch, appVersion, limit });
  }

  @Get('filters')
  async filters() {
    return this.telemetryService.filters();
  }

  @Get('records')
  async records(
    @Query('socName') socName: string,
    @Query('modelSha256') modelSha256: string,
    @Query('backend') backend: string,
    @Query('isBatch') isBatch?: string,
    @Query('os') os?: string,
    @Query('limit') limit?: string,
  ) {
    if (!socName || !modelSha256 || !backend) {
      return { error: 'socName, modelSha256, and backend are required' };
    }
    return this.telemetryService.records({ socName, modelSha256, backend, isBatch, os, limit });
  }
}
