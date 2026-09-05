import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { AdminRequest, REMOTE_CONFIG_ACTIONS } from '../types/remote-config';
import { RemoteConfigService } from './remote-config.service';

interface UploadRemoteConfigBody {
  fileName?: string;
  content?: string;
  publishNow?: boolean;
  modelScopeOnly?: boolean;
}

@Controller('admin-api/remote-configs')
@UseGuards(AdminAuthGuard)
export class RemoteConfigAdminController {
  constructor(private readonly remoteConfigService: RemoteConfigService) {}

  @Get('files')
  async listFiles() {
    return this.remoteConfigService.listConfigFiles();
  }

  @Get('activities')
  async listActivities(@Query('limit') rawLimit?: string) {
    const parsedLimit = Number.parseInt(rawLimit || '40', 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 40;
    return this.remoteConfigService.listActivities(limit);
  }

  @Post('upload')
  async uploadConfig(@Body() body: UploadRemoteConfigBody, @Req() request: AdminRequest) {
    if (!body.fileName || !body.content) {
      throw new BadRequestException('fileName and content are required');
    }

    return this.remoteConfigService.createVersion({
      fileName: body.fileName,
      content: body.content,
      createdBy: request.adminUser || 'unknown',
      publishNow: body.publishNow ?? false,
      modelScopeOnly: body.modelScopeOnly,
    });
  }

  @Post(':id/publish')
  async publishConfig(@Param('id', ParseIntPipe) id: number, @Req() request: AdminRequest) {
    return this.remoteConfigService.publishVersion(id, request.adminUser || 'unknown');
  }

  @Get(':id/content')
  async getConfigContent(@Param('id', ParseIntPipe) id: number) {
    const record = await this.remoteConfigService.getConfigById(id);
    if (!record) {
      throw new BadRequestException('Config not found');
    }

    return {
      id: record.id,
      fileName: record.fileName,
      content: record.content,
    };
  }

  @Get('archive/download')
  async downloadArchive(
    @Query('scope') scope: 'all' | 'published' | undefined,
    @Req() request: AdminRequest,
    @Res() response: Response,
  ) {
    const normalizedScope = scope === 'all' ? 'all' : 'published';
    const archive = await this.remoteConfigService.buildArchive(normalizedScope);

    await this.remoteConfigService.logActivity({
      action: REMOTE_CONFIG_ACTIONS.downloadArchive,
      username: request.adminUser || 'unknown',
      detail: {
        scope: normalizedScope,
        count: archive.entryCount,
      },
    });

    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', `attachment; filename="${archive.fileName}"`);
    response.send(archive.buffer);
  }

  @Get(':id/download')
  async downloadConfig(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AdminRequest,
    @Res() response: Response,
  ) {
    const record = await this.remoteConfigService.getConfigById(id);
    if (!record) {
      throw new BadRequestException('Config not found');
    }

    await this.remoteConfigService.logActivity({
      action: REMOTE_CONFIG_ACTIONS.download,
      username: request.adminUser || 'unknown',
      fileName: record.fileName,
      remoteConfigId: record.id,
    });

    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(record.fileName)}"`,
    );
    response.send(record.content);
  }
}
