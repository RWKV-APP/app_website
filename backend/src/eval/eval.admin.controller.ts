import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import type { EvalUploadRequest } from '../types/eval';
import { EvalService } from './eval.service';

interface UploadEvalBody {
  fileName?: string;
  content?: string;
  deviceLabel?: string;
  deviceChip?: string;
}

@Controller('admin-api/evals')
@UseGuards(AdminAuthGuard)
export class EvalAdminController {
  constructor(private readonly evalService: EvalService) {}

  @Post('upload')
  async uploadEval(@Body() body: UploadEvalBody, @Req() request: EvalUploadRequest) {
    if (!body.fileName || !body.content) {
      throw new BadRequestException('fileName and content are required');
    }

    return this.evalService.importEvalFile({
      fileName: body.fileName,
      content: body.content,
      uploadedBy: request.adminUser || 'unknown',
      deviceLabel: body.deviceLabel,
      deviceChip: body.deviceChip,
    });
  }

  @Get('runs')
  async listRuns() {
    return this.evalService.listRuns();
  }
}
