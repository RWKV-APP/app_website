import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import type { Request } from 'express';

@Controller('public-api/telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('perf')
  async uploadPerf(@Body() body: any, @Req() req: Request) {
    return this.telemetryService.ingest(body, req.ip ?? null);
  }

  @Get('leaderboard')
  async leaderboard(
    @Query('socName') socName?: string,
    @Query('modelSha256') modelSha256?: string,
    @Query('backend') backend?: string,
    @Query('os') os?: string,
    @Query('limit') limit?: string,
  ) {
    return this.telemetryService.leaderboard({ socName, modelSha256, backend, os, limit });
  }
}
