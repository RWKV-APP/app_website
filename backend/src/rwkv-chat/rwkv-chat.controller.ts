import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import type { AdminRequest } from '../types/remote-config';
import { RwkvChatService } from './rwkv-chat.service';

@Controller('admin-api/rwkv-chat')
@UseGuards(AdminAuthGuard)
export class RwkvChatController {
  constructor(private readonly rwkvChatService: RwkvChatService) {}

  @Get('conversations')
  async listConversations() {
    return this.rwkvChatService.listConversations();
  }

  @Post('conversations')
  async createConversation(@Body() body: unknown, @Req() request: AdminRequest) {
    return this.rwkvChatService.createConversation(body || {}, request.adminUser || 'unknown');
  }

  @Get('conversations/:id')
  async getConversation(@Param('id', ParseIntPipe) id: number) {
    return this.rwkvChatService.getConversation(id);
  }

  @Delete('conversations/:id')
  async deleteConversation(@Param('id', ParseIntPipe) id: number) {
    return this.rwkvChatService.deleteConversation(id);
  }

  @Post('messages/:id/select-slot')
  async selectMessageSlot(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.rwkvChatService.selectMessageSlot(id, body || {});
  }

  @Post('messages/:id/stop')
  async stopMessage(@Param('id', ParseIntPipe) id: number) {
    return this.rwkvChatService.stopMessage(id);
  }

  @Post('stream')
  async stream(
    @Body() body: unknown,
    @Req() request: AdminRequest & Request,
    @Res() response: Response,
  ) {
    await this.rwkvChatService.stream(body || {}, request, response);
  }
}
