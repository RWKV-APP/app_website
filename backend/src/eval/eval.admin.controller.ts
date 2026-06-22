import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import type { EvalUploadRequest } from '../types/eval';
import { EvalService } from './eval.service';

interface EvalSettingsBody {
  passThreshold?: number;
  highScoreLanguages?: string[];
  activeHighScoreRunIds?: string[];
}

interface UploadedArchiveFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

@Controller('admin-api/evals')
@UseGuards(AdminAuthGuard)
export class EvalAdminController {
  constructor(private readonly evalService: EvalService) {}

  @Post('upload-run')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 64 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  async uploadRunArchive(
    @UploadedFile() file: UploadedArchiveFile | undefined,
    @Req() request: EvalUploadRequest,
  ) {
    if (!file?.buffer || !file.originalname) {
      throw new BadRequestException('A single run zip file is required.');
    }

    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('Only .zip run archives are supported.');
    }

    return this.evalService.importRunArchive({
      fileName: file.originalname,
      buffer: file.buffer,
      uploadedBy: request.adminUser || 'unknown',
    });
  }

  @Get('settings')
  async getSettings() {
    return this.evalService.getSettings();
  }

  @Put('settings')
  async updateSettings(@Body() body: EvalSettingsBody) {
    if (typeof body.passThreshold !== 'number') {
      throw new BadRequestException('passThreshold is required.');
    }

    if (
      body.highScoreLanguages !== undefined &&
      (!Array.isArray(body.highScoreLanguages) ||
        body.highScoreLanguages.some((v) => typeof v !== 'string'))
    ) {
      throw new BadRequestException('highScoreLanguages must be an array of strings.');
    }

    if (
      body.activeHighScoreRunIds !== undefined &&
      (!Array.isArray(body.activeHighScoreRunIds) ||
        body.activeHighScoreRunIds.some((v) => typeof v !== 'string'))
    ) {
      throw new BadRequestException('activeHighScoreRunIds must be an array of strings.');
    }

    return this.evalService.updateSettings({
      passThreshold: body.passThreshold,
      highScoreLanguages: body.highScoreLanguages,
      activeHighScoreRunIds: body.activeHighScoreRunIds,
    });
  }

  @Get('runs')
  async listRuns() {
    return this.evalService.listRuns();
  }
}
