import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import type { Request, Response } from 'express';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';

const compress = promisify(gzip);

@Controller('public-api/telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('perf')
  @HttpCode(200)
  async uploadPerf(@Body() body: any, @Req() req: Request) {
    return this.telemetryService.ingest(body, req.ip ?? null);
  }

  private async respond(req: Request, res: Response, data: unknown) {
    const json = JSON.stringify(data);
    res.setHeader('Cache-Control', 'public, max-age=15');
    res.vary('Accept-Encoding');
    res.type('application/json');
    if (
      json.length >= 1024 &&
      req.headers['accept-encoding'] &&
      req.acceptsEncodings('gzip', 'identity') === 'gzip'
    ) {
      res.setHeader('Content-Encoding', 'gzip');
      res.send(await compress(json));
    } else {
      res.send(json);
    }
  }

  @Get('browse/filters')
  async browseFilters(@Req() req: Request, @Res() res: Response) {
    return this.respond(req, res, await this.telemetryService.publicFilters());
  }

  @Get('browse')
  async browse(
    @Req() req: Request,
    @Res() res: Response,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('recordId') recordId?: string,
    @Query('os') os?: string,
    @Query('appVersion') appVersion?: string,
    @Query('buildMode') buildMode?: string,
    @Query('batchCount') batchCount?: string,
    @Query('modelTag') modelTag?: string,
    @Query('modelSize') modelSize?: string,
    @Query('socBrand') socBrand?: string,
    @Query('socName') socName?: string,
  ) {
    return this.respond(
      req,
      res,
      await this.telemetryService.publicRecords({
        page,
        limit,
        recordId,
        os,
        appVersion,
        buildMode,
        batchCount,
        modelTag,
        modelSize,
        socBrand,
        socName,
      }),
    );
  }

  @Get('leaderboard')
  async leaderboard(
    @Req() req: Request,
    @Res() res: Response,
    @Query('socName') socName?: string,
    @Query('modelSha256') modelSha256?: string,
    @Query('backend') backend?: string,
    @Query('os') os?: string,
    @Query('isBatch') isBatch?: string,
    @Query('appVersion') appVersion?: string,
    @Query('buildMode') buildMode?: string,
    @Query('limit') limit?: string,
  ) {
    return this.respond(
      req,
      res,
      await this.telemetryService.leaderboard({
        socName,
        modelSha256,
        backend,
        os,
        isBatch,
        appVersion,
        buildMode,
        limit,
      }),
    );
  }

  @Get('filters')
  async filters(@Req() req: Request, @Res() res: Response) {
    return this.respond(req, res, await this.telemetryService.filters());
  }

  @Get('records')
  async records(
    @Req() req: Request,
    @Res() res: Response,
    @Query('socName') socName: string,
    @Query('modelSha256') modelSha256: string,
    @Query('backend') backend: string,
    @Query('isBatch') isBatch?: string,
    @Query('batchCount') batchCount?: string,
    @Query('os') os?: string,
    @Query('appVersion') appVersion?: string,
    @Query('buildMode') buildMode?: string,
    @Query('limit') limit?: string,
  ) {
    if (!socName || !modelSha256 || !backend) {
      return res.status(400).json({ error: 'socName, modelSha256, and backend are required' });
    }
    return this.respond(
      req,
      res,
      await this.telemetryService.records({
        socName,
        modelSha256,
        backend,
        isBatch,
        batchCount,
        os,
        appVersion,
        buildMode,
        limit,
      }),
    );
  }
}
