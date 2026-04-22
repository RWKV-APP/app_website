import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { TelemetryService } from './telemetry.service';

@Controller('admin-api/telemetry')
@UseGuards(AdminAuthGuard)
export class TelemetryAdminController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Get('filters')
  async filters() {
    return this.telemetryService.adminFilters();
  }

  @Get('records')
  async records(
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
    return this.telemetryService.adminRecords({
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
    });
  }
}
